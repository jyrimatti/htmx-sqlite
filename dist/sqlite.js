/*

Extension to use SQLite database backend for Htmx over:
- HTTP as a range requests (used when hx-db starts with http:)
- OPFS
*/
(function(){
    var api;
    var httpBackendConfig;
    var sqlConfig;

    htmx.defineExtension('sqlite', {
        init: function (internalAPI) {
            api = internalAPI;
            httpBackendConfig = {
                maxPageSize: 4096,    // this is the current default SQLite page size
                timeout:     10000,   // 10s
                cacheSize:   4096     // 4 MB
                //backendType: 'sync' // 'sync' or 'shared'. Defaults to 'shared' if available, otherwise sync;
            };
            sqlConfig = {
                rowMode: 'object'
            }
        },

        onEvent: function (name, evt) {
            if (name === "htmx:beforeRequest") {
                let elt = evt.detail.elt;

                var rc = evt.detail.requestConfig;
                var sql;
                if (rc.path === 'this.value' ||
                    rc.verb.toUpperCase() === 'GET'    && rc.path.toUpperCase().startsWith('SELECT ') ||
                    rc.verb.toUpperCase() === 'PUT'    && rc.path.toUpperCase().startsWith('UPDATE ') ||
                    rc.verb.toUpperCase() === 'DELETE' && rc.path.toUpperCase().startsWith('DELETE ') ||
                    rc.verb.toUpperCase() === 'POST'   && rc.path.toUpperCase().startsWith('INSERT ') ||
                    rc.verb.toUpperCase() === 'POST'   && rc.path.toUpperCase().startsWith('ALTER ') ||
                    rc.verb.toUpperCase() === 'POST'   && rc.path.toUpperCase().startsWith('CREATE ') ||
                    rc.verb.toUpperCase() === 'POST'   && rc.path.toUpperCase().startsWith('DROP ') ||
                    rc.verb.toUpperCase() === 'POST'   && rc.path.toUpperCase().startsWith('TRUNCATE ')) {
                    sql = rc.path;
                } else {
                    return true;
                }

                if (sql === "this.value") {
                    // use field value if path is just "SELECT"
                    sql = elt.value;
                    if (!evt.detail.target) {
                        throw new Error("Attribute 'hx-target' is required when value is used is empty");
                    }
                }

                var dbElem = htmx.closest(elt, '[hx-db]');
                if (!dbElem) {
                    throw new Error("Attribute 'hx-db' is required in the ancestor hierarchy");
                }
                var dbURI = dbElem.getAttribute('hx-db');

                var onload = evt.detail.xhr.onload;
                var onerror = evt.detail.xhr.onerror;
                evt.detail.xhr = {
                    status: 200,
                    getAllResponseHeaders: function() {
                        return "Content-Type:application/json";
                    },
                    getResponseHeader: function(headerName) {
                        if (headerName.toLowerCase() === "content-type") {
                            return "application/json";
                        }
                        return undefined;
                    }
                };

                // use Htmx parameters as bind variables
                var binds = {};
                Object.entries(evt.detail.requestConfig.parameters).forEach(function([k,v]) {
                    // include only binds present in the query
                    if (sql.indexOf('$' + k) > -1) {
                        binds['$' + k] = v;
                    }
                });

                var configElem = htmx.closest(elt, '[hx-request]');
                var conf = configElem ? JSON.parse(configElem.getAttribute('hx-request')) : {};
                var config = {
                    ...httpBackendConfig,
                    ...sqlConfig,
                    ...conf
                };

                var contextElem = htmx.closest(elt, '[hx-db],[hx-request]');
                
                var backend;
                if (contextElem._htmx_sqlite_http_backend) {
                    backend = contextElem._htmx_sqlite_http_backend;
                } else {
                    backend = dbURI.match(/^https?:/) ? { http: sqliteWasmHttp.createHttpBackend(config) }
                                                        : {};
                    contextElem._htmx_sqlite_http_backend = backend;
                }
                contextElem.addEventListener('htmx:beforeCleanupElement', function(ev) {
                    if (ev.detail.elt == contextElem && contextElem._htmx_sqlite_http_backend && contextElem._htmx_sqlite_http_backend.http) {
                        contextElem._htmx_sqlite_http_backend.http.close();
                        delete contextElem._htmx_sqlite_http_backend;
                    }
                });

                var allRows = [];
                sqliteWasmHttp.createSQLiteThread(backend)
                    .then(function(db) {
                        db('open', {
                            filename: encodeURI(dbURI.match(/^https?:\/\//) ? dbURI : dbURI.replace(/^opfs:/, '').replace(/^https?:/, 'file:')),
                            vfs: dbURI.replace(/:.*/,'').replace('https', 'http')
                        });
                        return db;
                    })
                    .then(function(db) {
                        api.triggerEvent(elt, 'htmx:xhr:loadstart', { elt: elt, xhr: {...evt.detail.xhr, db: db} });
                        db('exec', {
                            sql:      sql,
                            bind:     binds,
                            rowMode:  config.rowMode,
                            callback: function(data) {
                                if (data.row) {
                                    allRows.push(data.row);
                                    api.triggerEvent(elt, 'htmx:xhr:progress', { elt: elt, xhr: { ...evt.detail.xhr, db: db, response: JSON.stringify(data.row), responseJSON: data.row } });
                                } else {
                                    api.triggerEvent(elt, 'htmx:xhr:loadend', { elt: elt, xhr: { ...evt.detail.xhr, db: db, response: allRows.length == 0 ? '' : JSON.stringify(allRows), responseJSON: allRows } });

                                    db('close', {}) // This closes the DB connection
                                        .then(function() {
                                            db.close(); // This terminates the SQLite worker
                                        });
                                    
                                    evt.detail.xhr.responseJSON = allRows;
                                    evt.detail.xhr.response     = JSON.stringify(allRows);
                                    onload();
                                }
                            }
                        })
                        .catch(function(data) {
                            if (data.result) {
                                evt.detail.error = data.result.message;
                            }
                            onerror();
                        });
                    });
                
                // return false to stop Htmx processing. We are calling load() ourselves.
                return false;
            }
        }
    });

})();

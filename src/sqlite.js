/*

Extension to use SQLite database backend for Htmx over:
- HTTP as a range requests (used when hx-db starts with http:)
- OPFS
*/
(function(){
    var api;
    var httpBackendConfig;

    // lot's of copying from htmx source. It should probably export some of this stuff as functions in internal API?
    var getParameters = function (elt) {
        var results = api.getInputValues(elt, 'post');
        var rawParameters = results.values;
        var expressionVars = api.getExpressionVars(elt);
        var allParameters = api.mergeObjects(rawParameters, expressionVars);
        var filteredParameters = api.filterValues(allParameters, elt);
        return filteredParameters;
    };

    // lot's of copying from htmx source. It should probably export some of this stuff as functions in internal API?
    var swapAndSettle = function(data, elt, responseInfo) {
        var target = api.getTarget(elt);
        if (target == null || target == api.DUMMY_ELT) {
            api.triggerErrorEvent(elt, 'htmx:targetError', {target: api.getAttributeValue(elt, "hx-target")});
            return;
        }

        var beforeSwapDetails = {shouldSwap: true, target: target, elt: elt};
        if (!api.triggerEvent(target, 'htmx:beforeSwap', beforeSwapDetails)) return;
        target = beforeSwapDetails.target;
        
        responseInfo.target = target;
        responseInfo.failed = false;
        responseInfo.successful = true;

        var serverResponse = data.length == 0 ? "" : JSON.stringify(data);
        if (beforeSwapDetails.shouldSwap) {
            api.withExtensions(elt, function (extension) {
                serverResponse = extension.transformResponse(serverResponse, undefined, elt);
            });

            var swapSpec = api.getSwapSpecification(elt, undefined);

            target.classList.add(htmx.config.swappingClass);

            var doSwap = function () {
                try {
                    var activeElt = document.activeElement;
                    var selectionInfo = {};
                    try {
                        selectionInfo = {
                            elt: activeElt,
                            start: activeElt ? activeElt.selectionStart : null,
                            end: activeElt ? activeElt.selectionEnd : null
                        };
                    } catch (e) {
                        // safari issue - see https://github.com/microsoft/playwright/issues/5894
                    }

                    var settleInfo = api.makeSettleInfo(target);
                    api.selectAndSwap(swapSpec.swapStyle, target, elt, serverResponse, settleInfo, undefined);

                    if (selectionInfo.elt &&
                        !api.bodyContains(selectionInfo.elt) &&
                        api.getRawAttribute(selectionInfo.elt, "id")) {
                        var newActiveElt = document.getElementById(api.getRawAttribute(selectionInfo.elt, "id"));
                        var focusOptions = { preventScroll: swapSpec.focusScroll !== undefined ? !swapSpec.focusScroll : !htmx.config.defaultFocusScroll };
                        if (newActiveElt) {
                            if (selectionInfo.start && newActiveElt.setSelectionRange) {
                                try {
                                    newActiveElt.setSelectionRange(selectionInfo.start, selectionInfo.end);
                                } catch (e) {
                                    // the setSelectionRange method is present on fields that don't support it, so just let this fail
                                }
                            }
                            newActiveElt.focus(focusOptions);
                        }
                    }

                    target.classList.remove(htmx.config.swappingClass);
                    settleInfo.elts.forEach(function (elt) {
                        if (elt.classList) {
                            elt.classList.add(htmx.config.settlingClass);
                        }
                        api.triggerEvent(elt, 'htmx:afterSwap', responseInfo);
                    });

                    var doSettle = function () {
                        settleInfo.tasks.forEach(function (task) {
                            task.call();
                        });
                        settleInfo.elts.forEach(function (elt) {
                            if (elt.classList) {
                                elt.classList.remove(htmx.config.settlingClass);
                            }
                            api.triggerEvent(elt, 'htmx:afterSettle', responseInfo);
                        });
                    }

                    if (swapSpec.settleDelay > 0) {
                        setTimeout(doSettle, swapSpec.settleDelay)
                    } else {
                        doSettle();
                    }
                } catch (e) {
                    api.triggerErrorEvent(elt, 'htmx:swapError', responseInfo);
                    throw e;
                }
            };

            var shouldTransition = htmx.config.globalViewTransitions
            if(swapSpec.hasOwnProperty('transition')){
                shouldTransition = swapSpec.transition;
            }

            if(shouldTransition &&
                api.triggerEvent(elt, 'htmx:beforeTransition', responseInfo) &&
                typeof Promise !== "undefined" && document.startViewTransition){
                var settlePromise = new Promise(function (_resolve, _reject) {
                    settleResolve = _resolve;
                    settleReject = _reject;
                });
                var innerDoSwap = doSwap;
                doSwap = function() {
                    document.startViewTransition(function () {
                        innerDoSwap();
                        return settlePromise;
                    });
                }
            }


            if (swapSpec.swapDelay > 0) {
                setTimeout(doSwap, swapSpec.swapDelay)
            } else {
                doSwap();
            }
        }
    };

    htmx.defineExtension('sqlite', {
        init: function (internalAPI) {
            api = internalAPI;
            httpBackendConfig = {
                maxPageSize: 4096,    // this is the current default SQLite page size
                timeout:     10000,   // 10s
                cacheSize:   4096     // 4 MB
            };
        },
        onEvent: function (name, evt) {
            if (name === "htmx:afterProcessNode") {
                let elt = evt.detail.elt;

                if (elt.hasAttribute('hx-sql')) {
                    var triggerSpecs = api.getTriggerSpecs(elt);
                    triggerSpecs.forEach(function(triggerSpec) {
                        var nodeData = api.getInternalData(elt);
                        api.addTriggerHandler(elt, triggerSpec, nodeData, function (elt, evt) {
                            if (htmx.closest(elt, htmx.config.disableSelector)) {
                                cleanUpElement(elt);
                                return;
                            }

                            // use Htmx parameters as bind variables
                            var binds = {};
                            Object.entries(getParameters(elt)).forEach(function([k,v]) {
                                binds['$' + k] = v;
                            });

                            var sql = elt.getAttribute('hx-sql');
                            if (sql == "") {
                                // use form field value if hx-sql is empty
                                sql = elt.value;
                                if (!htmx.closest(elt, '[hx-target]')) {
                                    throw new Error("Attribute 'hx-target' is required when 'hx-sql' is empty");
                                }
                            }

                            var dbElem = htmx.closest(elt, '[hx-db]');
                            if (!dbElem) {
                                throw new Error("Attribute 'hx-db' is required in the ancestor hierarchy");
                            }

                            var configElem = htmx.closest(elt, '[hx-db-config]');
                            var conf = configElem ? JSON.parse(configElem.getAttribute('hx-db-config')) : {};
                            var config = { ...httpBackendConfig,
                                            ...conf
                                            };
                            var dbURI = dbElem.getAttribute('hx-db');
                            
                            var backend;
                            if (dbElem._htmx_sqlite_http_backend) {
                                backend = dbElem._htmx_sqlite_http_backend;
                            } else {
                                backend = dbURI.match(/^https?:/) ? { http: sqliteWasmHttp.createHttpBackend(config) }
                                                                  : {};
                                dbElem._htmx_sqlite_http_backend = backend;
                            }
                            dbElem.addEventListener('htmx:beforeCleanupElement', function(ev) {
                                if (ev.detail.elt == dbElem && dbElem._htmx_sqlite_http_backend && dbElem._htmx_sqlite_http_backend.http) {
                                    dbElem._htmx_sqlite_http_backend.http.close();
                                    delete dbElem._htmx_sqlite_http_backend;
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
                                    api.triggerEvent(elt, 'htmx:sql:loadstart', { elt: elt, xhr: { db: db } });
                                    db('exec', {
                                        sql:      sql,
                                        bind:     binds,
                                        rowMode:  "object",
                                        callback: function(data) {
                                            if (data.row) {
                                                allRows.push(data.row);
                                                api.triggerEvent(elt, 'htmx:sql:progress', { elt: elt, xhr: { db: db, response: data.row } });
                                            } else {
                                                api.triggerEvent(elt, 'htmx:sql:loadend', { elt: elt, xhr: { db: db, response: allRows } });

                                                db('close', {}) // This closes the DB connection
                                                    .then(function() {
                                                        db.close(); // This terminates the SQLite worker
                                                    });
                                                
                                                var responseInfo = { elt: elt, xhr: { response: allRows }, target: api.getTarget(elt) };
                                                var cancel = !api.triggerEvent(elt, 'htmx:beforeOnLoad', responseInfo);
                                                if (responseInfo.target && !cancel) {
                                                    swapAndSettle(allRows, elt, responseInfo);
                                                }
                                            }
                                       }
                                    });
                                });
                        });
                    });
                }
            }
        }
    });

})();

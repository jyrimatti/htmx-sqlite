# htmx-sqlite
Htmx extension to use SQLite database backend over HTTP or OPFS.

### Status

Experimental. I've used this a little, but not much.
Any feedback and suggestions are welcome!

### General concept

This extension is a wrapper for [https://github.com/mmomtchev/sqlite-wasm-http]. Please have a look for more information of the underlying database access implementation.

The http backend is kept open for the lifetime of the element having the corresponding `hx-db` attribute.

Following events are emitted:
- `htmx:sql:loadstart` when a query execution begins
   - `event.detail.xhr.db` is a promise for SQLite.Promiser
- `htmx:sql:progress` for each row of the result
   - `event.detail.xhr.db` is a promise for SQLite.Promiser
   - `event.detail.xhr.response` is the received data row
- `htmx:sql:loadend` when a query execution is finished (all rows are received) but before any swapping is 
performed.
   - `event.detail.xhr.db` is a promise for SQLite.Promiser
   - `event.detail.xhr.response` is all received data rows

In addition, `htmx:beforeOnLoad` will contain `event.detail.xhr.response` with an array of all received data rows.

### Install

Copy the following files under your app:
- https://unpkg.com/htmx-sqlite/dist/sqlite-wasm-http-main.js
- https://unpkg.com/htmx-sqlite/dist/sqlite-wasm-http-87.js
- https://unpkg.com/htmx-sqlite/dist/sqlite-wasm-http-806.js
- https://unpkg.com/htmx-sqlite/dist/sqlite-wasm-http-892.js
- https://unpkg.com/htmx-sqlite/dist/sqlite-wasm-http-901.js
- https://unpkg.com/htmx-sqlite/dist/sqlite-wasm-http-985.js
- https://unpkg.com/htmx-sqlite/dist/4fb34c1567962ff5a6c9.wasm

Include the following in your page:

```html
<script src="sqlite-wasm-http-main.js"></script>
<script src="https://unpkg.com/htmx-sqlite/dist/sqlite.min.js"></script>
```

### Usage

#### Use a database relative to current page over HTTP

```html
<body hx-ext="sqlite" hx-db="http:/mydb.db">
  <div hx-boost="true" hx-trigger="load" hx-sql="SELECT * FROM mytable"></div>
</body>
```

#### Use a database with absolute address over HTTP

```html
<body hx-ext="sqlite" hx-db="https://example.com/mydb.db">
  <div hx-boost="true" hx-trigger="load" hx-sql="SELECT * FROM mytable"></div>
</body>
```

#### Define local OPFS database

```html
<body hx-ext="sqlite" hx-db="opfs:mydb.db">
   <div hx-sql="CREATE TABLE IF NOT EXISTS mytable(name STRING); INSERT INTO mytable VALUES ('foo'); SELECT * FROM mytable" hx-boost="true" hx-trigger="load"></div>
</body>
```


#### Render response with client-side-templates

```html
<script crossorigin src="https://unpkg.com/htmx.org@1.9.6/dist/ext/client-side-templates.js"></script>
<template id="template">
   {{#data}}{{name}}{{/data}}
</template>
<script>
   Handlebars.registerPartial("template", Handlebars.compile(document.getElementById("template").innerHTML));
</script>
<div hx-boost="true" hx-trigger="load" handlebars-array-template="template" hx-sql="SELECT * FROM mytable"></div>
```

#### Handle response rows one-by-one with javascript

```html
<div hx-boost="true"
     hx-trigger="load"
     hx-sql="SELECT * FROM mytable"
     hx-on:sql:loadstart="console.log('started');"
     hx-on:sql:progress="this.innerText+=event.detail.xhr.response;"
     hx-on:sql:loadend="console.log('finished');"></div>
```

#### Handle the whole result with javascript

```html
<div hx-boost="true" hx-trigger="load" hx-on:htmx:before-on-load="this.innerText='Got: '+event.detail.xhr.response.length+' rows';" hx-sql="SELECT * FROM mytable"></div>
```


#### Include bind parameters explicitly, and load on change

```html
<input name="ident" value="2" />
<div hx-boost="true" hx-include="[name='ident']" hx-trigger="load, change from:[name='ident']" hx-sql="SELECT * FROM mytable WHERE ident=$ident"></div>
```

#### Use _value_ as the query if hx-sql is empty

```html
<select hx-boost="true" hx-sql="" hx-trigger="change" hx-target="#target">
   <option disabled selected value></option>
   <option value="SELECT name FROM mytable">name</option>
   <option value="SELECT age FROM mytable">age</option>
</select>
<div id="target"></div>
```

#### Override default config

```html
<div hx-boost="true" hx-trigger="load" hx-sql="SELECT * FROM mytable" hx-db-config="{ maxPageSize: 4096, timeout: 10000, cacheSize: 4096 }"></div>
```

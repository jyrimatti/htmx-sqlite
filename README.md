# htmx-sqlite
Htmx extension to use SQLite database backend over HTTP or OPFS.

### Status

Experimental. I've used this a little, but not much.
Any feedback and suggestions are welcome!


### Install

Copy the following files under your app:
- https://unpkg.com/htmx-sqlite/dist/sqlite-wasm-http-main.js
- https://unpkg.com/htmx-sqlite/dist/sqlite-wasm-http-631.js
- https://unpkg.com/htmx-sqlite/dist/sqlite-wasm-http-719.js
- https://unpkg.com/htmx-sqlite/dist/sqlite-wasm-http-934.js
- https://unpkg.com/htmx-sqlite/dist/sqlite-wasm-http-945.js
- https://unpkg.com/htmx-sqlite/dist/459c285c9d90a7912bcd.wasm

```html
<script src="sqlite-wasm-http-main.js"></script>
<script src="https://unpkg.com/htmx-sqlite/dist/sqlite.js"></script>
```

### Usage

#### Define a database relative to current page over HTTP

```html
<body hx-ext="sqlite" hx-db="http:/mydb.db">
  <div hx-boost="true" hx-trigger="load" hx-sql="SELECT * FROM mytable WHERE name=$name"></div>
</body>
```

#### Define a database with absolute address over HTTP

```html
<body hx-ext="sqlite" hx-db="http://example.com/mydb.db">
  <div hx-boost="true" hx-trigger="load" hx-sql="SELECT * FROM mytable WHERE name=$name"></div>
</body>
```

#### Define local OPFS database

```html
<div hx-db="opfs:mydb.db" hx-sql="SELECT * FROM mytable" hx-boost="true" hx-trigger="load"></div>
```


#### Render response with client-side-templates

```html
<script crossorigin src="https://unpkg.com/htmx.org@1.9.6/dist/ext/client-side-templates.js"></script>
<template id="template">
   {{#data}}
      {{c}} <i>c/kWh</i>
   {{/data}}
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

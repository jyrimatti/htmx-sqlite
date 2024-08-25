var expect = chai.expect;

describe("sqlite extension", function() {
    this.timeout(5000); 

    beforeEach(function (done) {
        clearWorkArea();
        let div = make('<div hx-boost="true" hx-trigger="load" hx-sql="CREATE TABLE IF NOT EXISTS mytable(name STRING);DELETE FROM mytable;"></div>')
        div.addEventListener('htmx:sql:loadend', () => {
            done();
        });
    });

    describe('General stuff', function () {
        it('can make multiple queries', function (done) {
            var div = make('<div hx-boost="true" hx-trigger="load" hx-sql="INSERT INTO mytable VALUES(\'foo\'); SELECT * FROM mytable"></div>');
            var handler = () => {
                div.innerText.should.equal('[{"name":"foo"}]');
                var div2 = make('<div hx-boost="true" hx-trigger="load" hx-sql="INSERT INTO mytable VALUES(\'bar\'); SELECT * FROM mytable"></div>');
                var handler2 = () => {
                    div2.innerText.should.equal('[{"name":"foo"},{"name":"bar"}]');
                    done();
                }
                div2.addEventListener('htmx:afterSettle', handler2);
            };
            div.addEventListener('htmx:afterSwap', handler);
        });

        it('empty result clears content', function (done) {
            var div = make('<div hx-boost="true" hx-trigger="load" hx-sql="SELECT * FROM mytable"></div>');
            div.addEventListener('htmx:afterSwap', () => {
                div.innerText.should.equal('');
                done();
            });
        });

        it('events', function (done) {
            var div = make('<div hx-boost="true" hx-trigger="load" hx-sql="INSERT INTO mytable VALUES(\'foo\'); SELECT * FROM mytable"></div>');
            div.addEventListener('htmx:sql:loadstart', () => {
                div.addEventListener('htmx:sql:progress', () => {
                    div.addEventListener('htmx:sql:loadend', () => {
                        done();
                    });
                });
            });
        });

        it('override http config', function (done) {
            window.addEventListener('unhandledrejection', e => {
                e.reason.should.equal('Timeout while waiting on backend');
                done();
            });
            make(`<div hx-db="http:/test.db" hx-boost="true" hx-trigger="load" hx-db-config='{"timeout": 1}' hx-sql="SELECT * FROM mytable"></div>`);
        });
    });

    describe('Bind parameters', function () {
        it('hx-include', function (done) {
            make('<input type="text" name="nameParam" value="foo"/>');
            var div = make('<div hx-boost="true" hx-trigger="load" hx-include="[name=\'nameParam\']" hx-sql="INSERT INTO mytable VALUES(\'foo\'); SELECT * FROM mytable WHERE name=$nameParam"></div>');
            var handler = () => {
                div.innerText.should.equal('[{"name":"foo"}]');
                done();
            };
            div.addEventListener('htmx:afterSwap', handler);
        });

        it('whole form', function (done) {
            var div = make('<form><input type="text" name="nameParam" value="foo"/><div hx-boost="true" hx-trigger="load" hx-sql="INSERT INTO mytable VALUES(\'foo\'); SELECT * FROM mytable WHERE name=$nameParam"></div></form>');
            var handler = () => {
                div.innerText.should.equal('[{"name":"foo"}]');
                done();
            };
            div.addEventListener('htmx:afterSwap', handler);
        });
    });

    describe('Use value of form field when hx-sql is empty', function () {
        it('input', function (done) {
            let target = make('<div id="targ"></div>');
            make('<input type="text" hx-boost="true" hx-trigger="load" hx-sql="" hx-target="#targ" value="INSERT INTO mytable VALUES(\'foo\'); SELECT * FROM mytable"></div>');
            var handler = () => {
                target.innerText.should.equal('[{"name":"foo"}]');
                done();
            };
            target.addEventListener('htmx:afterSwap', handler);
        });

        it('textarea', function (done) {
            let target = make('<div id="targ"></div>');
            make('<textarea hx-boost="true" hx-trigger="load" hx-sql="" hx-target="#targ">INSERT INTO mytable VALUES(\'foo\'); SELECT * FROM mytable;</textarea>');
            var handler = () => {
                target.innerText.should.equal('[{"name":"foo"}]');
                done();
            };
            target.addEventListener('htmx:afterSwap', handler);
        });

        it('select', function (done) {
            let target = make('<div id="targ"></div>');
            make('<select hx-boost="true" hx-trigger="load" hx-sql="" hx-target="#targ"><option>INSERT INTO mytable VALUES(\'foo\'); SELECT * FROM mytable;</option><option selected>INSERT INTO mytable VALUES(\'bar\'); SELECT * FROM mytable;</option></select>');
            var handler = () => {
                target.innerText.should.equal('[{"name":"bar"}]');
                done();
            };
            target.addEventListener('htmx:afterSwap', handler);
        });
    });
});

(function (module, exports, fn) {
    'use strict';
    if (typeof module === 'undefined') {
        module = {
            exports: {}
        };

        window.gitIndexedDB = module;
    }

    if (typeof exports === 'undefined') {
        exports = module.exports;
    }

    fn(
        module,
        exports,
        window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB
    );
})(module, exports,
function (module, exports, indexedDB) {
    'use strict';
    var version = 1;
    var hashStoreName = 'hashs';
    var hashIndexKey = 'hash';
    var pathStoreName = 'paths';
    var pathIndexKey = 'path';
    var isHash = /^[a-z0-9]{40}$/;

    var deflate, inflate;
    module.exports = function (platform) {
        deflate = platform.deflate || fake;
        inflate = platform.inflate || fake;
        return db;
    };

    var fake = function fake(input, callback) {
        callback(null, input);
    };

    var db = function db(prefix) {
        var context = {};

        return {
            init: init.bind(context, prefix),
            get: get.bind(context),
            keys: keys.bind(context),
            set: set.bind(context),
            has: has.bind(context),
            del: del.bind(context),
            clear: clear.bind(context, prefix)
        };
    };

    var init = function init(prefix, callback) {
        if (!callback) return init.bind(this, prefix);
        var request = indexedDB.open(prefix, version);
        var context = this;

        request.addEventListener('upgradeneeded', function (e) {
            var db = e.target.result;

            var hashStore = db.createObjectStore(hashStoreName, { keyPath: hashIndexKey });

            var pathStore = db.createObjectStore(pathStoreName, { keyPath: pathIndexKey });
        });
        request.addEventListener('success', function (e) {
            context.db = e.target.result;
            callback();
        });
        request.addEventListener('error', function (e) {
            callback(e);
        });
    };

    var get = function get(key, callback) {
        if (!callback) return get.bind(this, key);
        var context = this;
        if (!callback) {
            return get.bind(this, key);
        }
        if (isHash.test(key)) {
            var transaction = context.db.transaction(hashStoreName);
            var store = transaction.objectStore(hashStoreName);

            var request = store.get(key);

            request.addEventListener('success', function (e) {
                callback(null, e.target.result.value);
            });
            request.addEventListener('error', function (e) {
                callback(e);
            });
        } else {
            var transaction = context.db.transaction(pathStoreName);
            var store = transaction.objectStore(pathStoreName);

            var request = store.get(key);

            request.addEventListener('success', function (e) {
                callback(null, e.target.result ? e.target.result.ref : undefined);
            });
            request.addEventListener('error', function (e) {
                callback(e);
            });
        }
    };

    var keys = function keys(prefix, callback) {
        if (!callback) return keys.bind(this, prefix);
        var context = this;

        var transaction = context.db.transaction(pathStoreName);
        var store = transaction.objectStore(pathStoreName);

        if (prefix) {
            var request = store.get(prefix);

            request.addEventListener('success', function (e) {
                if (e.target.result) {
                    callback(null, e.target.result.keys);
                } else {
                    callback(null, []);
                }
            });
            request.addEventListener('error', function (e) {
                callback(e);
            });
        } else {
            var request = store.openCursor();
            var refs = [];
            request.addEventListener('success', function (e) {
                var cursor = e.target.result;

                if (cursor) {
                    refs.push(cursor.value.ref);
                    cursor['continue']();
                }
            });
            request.addEventListener('error', function (e) {
                callback(e);
            });
            transaction.addEventListener('success', function (e) {
                callback(null, refs);
            });
        }
    };

    var set = function set(key, value, callback) {
        if (!callback) return set.bind(this, key, value);
        var context = this;
        if (!callback) {
            return set.bind(context, key, value);
        }

        if (isHash.test(key)) {
            var transaction = context.db.transaction(hashStoreName, 'readwrite');
            var store = transaction.objectStore(hashStoreName);
            var record = {
                value: value
            };
            record[hashIndexKey] = key;

            var request = store.put(record);

            transaction.addEventListener('complete', function (e) {
                callback();
            });
            transaction.addEventListener('error', function (e) {
                callback(e);
            });
        } else {
            var transaction = context.db.transaction(pathStoreName, 'readwrite');
            var store = transaction.objectStore(pathStoreName);
            var record = {
                ref: value
            };
            record[pathIndexKey] = key;

            var request = store.put(record);

            transaction.addEventListener('complete', function (e) {
                callback();
            });
            transaction.addEventListener('error', function (e) {
                callback(e);
            });
        }
    };

    var has = function has(key, callback) {
        if (!callback) return has.bind(this, key);
        var store = pathStoreName;
        var context = this;

        if (isHash.test(key)) {
            store = hashStoreName;
        }

        var transaction = context.db.transaction(store);
        var store = transaction.objectStore(store);

        var request = store.get(key);

        request.addEventListener('success', function (e) {
            callback(null, !!e.target.result);
        });
        request.addEventListener('error', function (e) {
            callback(e);
        });
    };

    var del = function del(key, callback) {
        if (!callback) return del.bind(this, key);

        var store = pathStoreName;
        var context = this;

        if (isHash.test(key)) {
            store = hashStoreName;
        }

        var transaction = context.db.transaction(store, 'readwrite');
        var store = transaction.objectStore(store);

        var request = store.delete(key);

        request.addEventListener('success', function (e) {
            callback();
        });
        request.addEventListener('error', function (e) {
            callback(e);
        });
    };

    var clear = function clear(prefix, callback) {
        if (!callback) return clear.bind(this, prefix);
        var context = this;

        context.db.close();

        var request = indexedDB.deleteDatabase(prefix);
        request.addEventListener('success', function (e) {
            callback();
        });
        request.addEventListener('error', function (e) {
            callback(e);
        });
    };
});

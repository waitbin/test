function IndexedDB(options) {
    this._indexedDB = window.indexedDB || window.webkitIndexedDB;
    this._isChangeVersion = false;
    this._options = options || {};
    this._db = null;
}

IndexedDB.prototype = {
    init: function () {
        var me = this;
        this._getIndexedDbServerVersion(this._options.store.tableName,function(data){
            if(data){
                if(parseInt(me._options.version) <= parseInt(data)){
                    me._options.version = data;
                }else{
                    me._isChangeVersion = true;
                    me._updateIndexedDbServerVersion(me._options.store.tableName,me._options.version);
                }
            }
            var request = me._indexedDB.open(me._options.server, me._options.version);
            //打开数据库做初始化方法,版本号改变会触发该回调
            request.onupgradeneeded = function () {
                var db = request.result;
                if(me._options.version == 1 || me._isChangeVersion ==true){
                    if (db.objectStoreNames.contains(me._options.store.tableName)) {
                        db.deleteObjectStore(me._options.store.tableName);
                        console.log("drop store=【"+me._options.store.tableName+"】 success ！");
                    }
                    var store = db.createObjectStore(me._options.store.tableName, me._options.store.key);
                    me._options.store.indexed.forEach(function (index) {
                        if(typeof(index.name) === "object"){
                            store.createIndex(index.name[0], index.name, index.unique);
                        } else{
                            store.createIndex(index.name, index.name, index.unique);
                        }
                    });
                    console.log("create store=【"+me._options.store.tableName+"】 success ！");
                }
                me._insertData(db);
            };
            //数据库创建或者连接成功回调函数
            request.onsuccess = function () {
                me._db = request.result;
            };
            request.onerror = function (event) {
                console.log(event);
            };
            return me;
        }) ;

    },
    _insertData: function (db) {
        console.log("insert store=【"+this._options.store.tableName+"】 start..............");
        var me = this;
        var time = new Date().getTime();
        me.clearStoreData(function(){
            me._getApiData(function (datas) {
                var time1 = new Date().getTime();
                console.log("fetch api=【"+me._options.apiDataUrl+"】 data use time==" + (time1 - time));
                var transaction = db.transaction([me._options.store.tableName], "readwrite");
                var objectStore = transaction.objectStore(me._options.store.tableName);
                datas.forEach(function (data) {
                    var request = objectStore.add(data);
                    request.onsuccess = function (event) {
                        console.log("insert into store success!");
                    };
                });
                transaction.oncomplete = function (event) {
                    console.log("insert into data all done！");
                    var time2 = new Date().getTime();
                    console.log("insert into indexeddb store=【"+me._options.store.tableName+"】 use time==" + (time2 - time1));
                };
            });
        }) ;
    },
    _getApiData: function (callback) {
        $.ajax({
                "type": "get",
                "url": this._options.apiDataUrl,
                "dataType": "json",
                "success": function (data) {
                    setTimeout(function(){
                        callback(data);
                    },50);
                }}
        );
    },
    _getIndexedDbServerVersion : function(name,callback){
        $.ajax({
                "type": "get",
                "url": Path.getUri("api/indexedDb-version/table-name/" + name),
                "success": function (data) {
                    callback(data);
                }}
        );
    },
    _updateIndexedDbServerVersion : function(tableName,version){
        $.ajax({
                "type": "put",
                "url": Path.getUri("api/indexedDb-version/table-name/" + tableName + "/" + version),
                "success": function (data) {
                    console.log("update store=【"+tableName+"】 server version success!");
                }}
        );
    },
    /**
     * 通过key删除store对应的数据
     * @param key
     */
    deleteDataByKey: function (key) {
        var me = this;
        var request = this._indexedDB.open(this._options.server, this._options.version);
        request.onsuccess = function (event) {
            me._db = request.result;
            var transaction = me._db.transaction([me._options.store.tableName], "readwrite");
            var objectStore = transaction.objectStore(me._options.store.tableName);
            request = objectStore.delete(key);
            request.onsuccess = function (event) {
                console.log("delete key==【" + key + "】 data success");
            };
        };
    },
    /**
     * 清除store的所有数据
     */
    clearStoreData: function (callback) {
        var me = this;
        var request = this._indexedDB.open(this._options.server, this._options.version);
        request.onsuccess = function (event) {
            me._db = request.result;
            var transaction = me._db.transaction([me._options.store.tableName], "readwrite");
            var objectStore = transaction.objectStore(me._options.store.tableName);
            request = objectStore.clear();
            request.onsuccess = function (event) {
                console.log("clear store=【" + me._options.store.tableName + "】 data success");
                callback();
            };
            request.onerror = function(event){
                console.log(event);
            };
        };
    },
    /**
     * 统计store的数量
     */
    countStoreData: function (callback) {
        var me = this;
        var request = this._indexedDB.open(this._options.server, this._options.version);
        request.onsuccess = function (event) {
            me._db = request.result;
            var transaction = me._db.transaction([me._options.store.tableName]);
            var objectStore = transaction.objectStore(me._options.store.tableName);
            objectStore.count().onsuccess = function (e) {
                console.log("count store=【"+me._options.store.tableName+"】 data success! is count ===" + e.target.result);
                callback(e.target.result);
            };
        };
    },
    /**
     * 修改一条store记录
     * @param value
     * @param callback
     */
    updateStoreData: function (value, callback) {
        var me = this;
        var request = this._indexedDB.open(this._options.server, this._options.version);
        request.onsuccess = function (event) {
            me._db = request.result;
            var transaction = me._db.transaction([me._options.store.tableName], "readwrite");
            var objectStore = transaction.objectStore(me._options.store.tableName);
            objectStore.put(value).onsuccess = function (e) {
                console.log("update store=【"+me._options.store.tableName+"】 data success! update key===" + e.target.result);
                callback(e.target.result);
            };
        };
    },
    /**
     * 根据store的主键（key）获取指定的记录
     * @param key主键id
     * @param callback 回调
     */
    getStoreDataByKey: function (key, callback) {
        var me = this;
        var request = this._indexedDB.open(this._options.server, this._options.version);
        var time = new Date().getTime();
        request.onsuccess = function (event) {
            me._db = request.result;
            var objectStore = me._db.transaction([me._options.store.tableName]).objectStore(me._options.store.tableName);
            objectStore.get(key).onsuccess = function (e) {
                var obj = e.target.result;
                if (obj == null) {
                    console.log("obj not found!");
                }
                else {
                    callback(obj);
                }
            };
            var time1 = new Date().getTime();
            console.log("from store=【"+me._options.store.tableName+"】 use key fetch data use time==" + (time1 - time));
        };
    },
    /**
     * 通过indexedDb游标获取所有数据
     * @param callback
     */
    getStoreDataByCursor: function (callback) {
        var me = this;
        var arr = [];
        var request = this._indexedDB.open(this._options.server, this._options.version);
        var time = new Date().getTime();
        request.onsuccess = function (event) {
            me._db = request.result;
            var objectStore = me._db.transaction([me._options.store.tableName]).objectStore(me._options.store.tableName);
            objectStore.openCursor().onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor) {
                    arr.push(cursor.value);
                    cursor.continue();
                }  else{
                    callback(arr);
                    var time1 = new Date().getTime();
                    console.log("from store=【"+me._options.store.tableName+"】 use cursor fetch data use time==" + (time1 - time));
                }
            };
        };
    },

    /**
     * 通过指定的索引查询记录
     * @param indexName 索引名称
     * @param indexValue 索引值 (可选) 不传值根据indexName查询所有的记录
     * @param callback
     */
    getStoreDataByIndex: function (indexName, indexValue, callback) {
        var me = this;
        var request = this._indexedDB.open(this._options.server, this._options.version);
        var arr = [];
        var time = new Date().getTime();
        request.onsuccess = function (event) {
            me._db = request.result;
            var objectStore = me._db.transaction([me._options.store.tableName]).objectStore(me._options.store.tableName);
            var range = null;
            if (indexValue != undefined || indexValue != null) {
                range = IDBKeyRange.only(indexValue);
            }
            var index = objectStore.index(indexName);
            index.openCursor(range).onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor) {
                    arr.push(cursor.value);
                    cursor.continue();
                } else{
                    callback(arr);
                    var time1 = new Date().getTime();
                    console.log("from store=【"+me._options.store.tableName+"】 use index 【"+indexName+"】 fetch data use time==" + (time1 - time));
                }
            };
        };
    },
    /**
     * 根据指定的索引模糊查询数据
     * @param indexName 索引名称
     * @param inputValue 需要模糊匹配的值
     * @param likeexper  模糊匹配规则（like%  ： inputValue开始匹配  %like ： inputValue结尾匹配  %%: inputValue 包含匹配）
     * @param callback
     */
    getStoreDataByLike: function (indexName, inputValue, likeexper, callback) {
        var me = this;
        var request = this._indexedDB.open(this._options.server, this._options.version);
        var time = new Date().getTime();
        var reg;
        if (new RegExp("%like").test(likeexper)) {
            reg = new RegExp(inputValue + "$");
        } else if (new RegExp("like%").test(likeexper)) {
            reg = new RegExp("^" + inputValue);
        } else {
            reg = new RegExp(inputValue);
        }
        var arr = [];
        request.onsuccess = function (event) {
            me._db = request.result;
            var objectStore = me._db.transaction([me._options.store.tableName]).objectStore(me._options.store.tableName);
            var index = objectStore.index(indexName);

            index.openCursor(null).onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor) {
                    if (reg.test(cursor.key)) {
                        arr.push(cursor.value);
                    }
                    cursor.continue();
                }  else{
                     if(arr.length){
                         callback(arr);
                         var time1 = new Date().getTime();
                         console.log("from store=【"+me._options.store.tableName+"】 use index= 【"+indexName+"】 by like fetch data use time==" + (time1 - time));
                     }
                }
            };
        };
    } ,
    /**
     * 从数组中遍历匹配的数据
     * @param array 需要检索的数组
     * @param indexName 索引名次
     * @param inputValue 匹配的值
     * @param likeexper  表达式
     * @param callback
     */
    getStoreDataByArray:function(array,indexName,inputValue, likeexper,callback){
       if(array.length){
           var time = new Date().getTime();
           var arrs = [];
           var reg;
           if (new RegExp("%like").test(likeexper)) {
               reg = new RegExp(inputValue + "$");
           } else if (new RegExp("like%").test(likeexper)) {
               reg = new RegExp("^" + inputValue);
           } else {
               reg = new RegExp(inputValue);
           }
           array.forEach(function(data){
               if (reg.test(data.indexName )) {
                   arrs.push(data);
               }
           });
           callback(arrs);
           var time1 = new Date().getTime();
           console.log("from array fetch data use time==" + (time1 - time));
       }
    }


};






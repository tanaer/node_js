/**
 * @file uri.js
 * @author sundong
 * 
 * 操作url
 * 
 * URL操作结构
 * 　
* 各部份具体样式及说明
 * 
 *   
 */
var runnable = function(fw,runfromServer){
    var fwuri = fw.addSubPackage('uri');
    var _uri = function(){
    	this.path = null;// {/debug.html}/hi-login?asdlfkj
    	this.params = null;// /debug.html{/hi-login}?asdlfkj
    	this.controller = null;
    	this.original = null;
    	this.session="";
    	this.type;
    	this.contr_argu = [];
    };
    var routerObj = null;
    
    // var parseFileFromUrl = function(filePath){// all files
    	// //1.  ?后的一切都不是file的name
		// if ( filePath.indexOf('?') != -1 ) {
            // filePath = filePath.substring(0,filePath.indexOf("?"));
        // }
        // //文件直接读取,使用baseurl，已经彻底解决此问题
        // if (filePath.match(/\.\w+$/) ) {
        	// if (filePath.indexOf('.html/') != -1){
        		// filePath = filePath.substring(filePath.indexOf(".html/")+5);
        	// }
        	// //检测controller的去减
        	// // if (!routerObj){
	    		// // routerObj = fw.router.getAll();
	    	// // }
// 	    	
        // }
    	// //2. /的前面如果有.html也舍弃后面的
    	// if ( filePath.indexOf('.html/') != -1) {
    		// filePath = filePath.substring(0,filePath.indexOf('.html/')+5);
    	// }
    	// //3. /前面没有.html，且匹配了定义的router,则返回index.html
    	// if ( !filePath.match(/\.\w+$/) ) {//文件直接读取
        	// filePath = "/index.html";
        // }
//     	
    	// return filePath;
    // };
    var parseFromUrl = function(filePath){
    	//0. 去掉#号
    	if (filePath.indexOf("#")!= -1) {
    		filePath = filePath.replace("#","");
    	};
    	filePath = filePath.replace(/\/+/g,"/");
    	
    	// hack to support no base_url router eg. debug.html/js/src/sumeru.js could be js/src/sumeru.js
        if (filePath.indexOf('.html/') != -1){
            if (filePath.match(/\.\w+$/) || filePath.match(/\.\w+\?/) ) {//static file
                filePath = filePath.substring(filePath.indexOf(".html/")+5);              
            }
        }
        
    	//1.  ?后的一切都不是file的name
    	var _filePath  = filePath;
    	var params="",controller="";
		if ( _filePath.search(/[?#!]/) != -1 ) {
			params = _filePath.substring(_filePath.search(/[?#!]/) + 1);//保留? #
			
		    _filePath = _filePath.substring(0,_filePath.search(/[?#!]/));
        }
        //2. /的前面如果有.html也舍弃后面的
    	if ( _filePath.indexOf('.html') != -1) {
    		controller = _filePath.substring(_filePath.indexOf('.html')+5);
    		_filePath = _filePath.substring(0,_filePath.indexOf('.html')+5);
    	}else if ( !_filePath.match(/\.\w+$/) ) {
    		//3. /前面没有.html，并且在?之前存在controller,则默认读取index.html,且设置controller
    		controller = _filePath;
    		_filePath = "/";
        }
        //判断静态文件
        if (filePath.match(/\.\w+/) && !filePath.match(/\.html/)) {//static file
            this.controller = null;
            this.path = _filePath;
            return this;
        }
        if (!routerObj){
    		routerObj = fw.router.getAll();
    	}
    	var contr_argu = [];//这个是controller后面带的参数
    	//check for controller
		var matchTmp,longest=-1,q=-1;//q 是记录第几个
		for(var i=0,len=routerObj.length;i<len;i++){
			
			if ((routerObj[i].path.toString().length>longest) && (matchTmp = controller.match(routerObj[i].path))){//由于match controller正则可能导致，只匹配一半
    			longest = routerObj[i].path.toString().length;
    			q = i;
    		}
    		
    	}
    	if (q>-1){// HAS MATCH ROUTER
    		if (runfromServer && !routerObj[q].server_render) {
    		    if (routerObj[q].type === 'file'){
    		        fw.log("router:fileUpload matche.",routerObj[q].path);
    		    }else{
    		        fw.log("router:server_render is false.",routerObj[q].path);
                }
    			controller = null;
    		}else{
    			if (longest == 0){//最长的就是空白
	    			if (controller.indexOf("/") == 0){
	    				controller=controller.substr(1);
	    			}
	    			contr_argu = controller.split("/");
		    		contr_argu.unshift("");
		    		controller = "";
	    		}else{
	    			matchTmp = controller.match(routerObj[q].path);
		    		contr_argu = controller.replace(routerObj[q].path,"");
					controller = matchTmp[0];
					contr_argu = contr_argu.split("/");
					contr_argu[0] = controller;
	    		}
    		}
    		
    		if (routerObj[q].type==='file'){
    		    this.type = routerObj[q].type;
    		    controller = null;//上传文件不需要server渲染
    		}
    	}else{// NO MATCH ROUTER
    		controller = null;
    		contr_argu.push("");
    	}
    	
    	var paramsObj = fw.utils.uriParamToMap(params);
    	//session begin
    	var identifier = controller + "!" ;
    	var sessionObj = {};
    	sessionObj[identifier] = JSON.stringify(paramsObj) ;
    	sessionObj = JSON.stringify(sessionObj);
    	var session = (sessionObj.substring(1,sessionObj.length - 1));
        
    	//TODO REMOVE paramstring LATER
    	
    	this.path = _filePath;
        this.params = paramsObj;
        this.controller = controller;
        this.session  = session;
        this.contr_argu = contr_argu;
    	return this;//{path:_filePath,params:paramsObj,controller:controller,session:session,contr_argu:contr_argu};
		
		
    };
    
    _uri.prototype = {
        parseFromUrl :parseFromUrl,
    	init : function(filePath){
    		this.original = filePath;
    		this.parseFromUrl(filePath);
    		
    	},
    	
    };
    fwuri.__reg("getInstance",function(url){
    	var uri = new _uri();
    	uri.init(url);
    	return uri;
    });
    // fwuri.__reg("parseFileFromUrl",parseFileFromUrl);
   
};

if(typeof module !='undefined' && module.exports){
    module.exports = function(fw){
    	runnable(fw,true);
    };
}else{
    runnable(sumeru);
}
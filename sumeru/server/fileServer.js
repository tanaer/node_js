var fw = require(__dirname + '/../src/newPkg.js')();
require(__dirname  + '/../src/log.js')(fw);

var config = fw.config;


var isBae = ((typeof process.BAE !== 'undefined') ? true : false);
//startup a server
var http = require("http"), 
    path = require('path'),
    fs = require('fs'),
    zlib = require('zlib'),
    appName = isBae?'':(process.argv[2] || '');

    module.exports = function(req, res){
        //localBase 为sumeru和 apps所在的根目录。
        var frkDir = __dirname + '/../../',
            localBase = frkDir + '/app'+ (appName ? '/' + appName : ''),
            filePath = req.url,
            range = typeof req.headers.range == 'string' ? req.headers.range : undefined;
        
        filePath = filePath.replace(/\.\.\//g, '');
        
        //把问号后面去掉
        // filePath = fw.router.parseFromUrl(filePath);
        // filePath = fw.uri.parseFileFromUrl(filePath);
        var fileObj = fw.uri.getInstance(filePath);
        filePath = fileObj.path;
        
        localBase = path.normalize(localBase);
        var view_from_cache = fw.config.get('view_from_cache');
        
        //黑名单的配置需要同步至bae的lighttpd配置中
        var deniedList = [ //黑名单
            new RegExp('^/publish/'),
            new RegExp('^/server_config/')
        ];
        
        for (var i=0; i < deniedList.length; i++) {
            if (deniedList[i].test(filePath)) {
                res.writeHead(403);//forbidden
                res.end();        
                return;
            };
        };
        //var filePath2 = filePath;//记录
        
        if(filePath == '/'){
            filePath = localBase + '/index.html';
        } else {
            var sumerujs = '/sumeru.js';
            var sumerudir = /sumeru\//g;
            var viewdir = /\/view\//;
            var sumeruPath = path.join(localBase, fw.config.get('sumeruPath'));

            if(sumerujs === filePath){
                filePath = sumeruPath + '/src/sumeru.js';
            }else if(view_from_cache && viewdir.test(filePath)){//hack it！在bin/view目录下读取编译后的
                if (filePath.indexOf("/bin")==0){
                	filePath = localBase + filePath;
                }else{
                	filePath = localBase +"/bin"+ filePath;
                }
                
            }else if(sumerudir.test(filePath)){
                filePath = sumeruPath + '/' + 
                    filePath.slice(filePath.lastIndexOf('sumeru/') + 'sumeru/'.length);
            }else{
                filePath = localBase + filePath;
            }
        }

        
        // fw.log('file server accessing ' + path.normalize(filePath));
        
        var extensionName = path.extname(filePath),
            contentType = 'text/html';
            extMap = {
                '.js' : 'text/javascript',
                '.css' : 'text/css',
                '.jpg' : 'image/jpeg',
                '.jpeg' : 'image/jpeg',
                '.png' : 'image/jpeg',
                '.ico' : 'image/jpeg',
                '.json' : 'text/json',
                '.manifest' : 'text/cache-manifest'
            },
            _binaryMap = ['.jpg','.jpeg','.png','.gif','.bmp','.mp3', '.ico', '.png'],
            binaryMap = {};
        
        _binaryMap.forEach(function(item){
            binaryMap[item] = true;
        });
        
        if(extMap[extensionName]){
            contentType = extMap[extensionName];
        }
        fs.exists(filePath, function(exists){
            if(exists){
                
                res.setHeader('Date', new Date().toString());
                //res.setHeader('Expires', new Date(new Date().getTime() + 24 * 3600 * 1000).toString());
                //必须设置下面三个参数， 才能保证浏览器正常更新服务器的文件
                res.setHeader('Cache-Control' , 'no-cache');
                res.setHeader('Expires', '0');
                res.setHeader('Vary', 'Accept-Encoding');
                
                var acceptEncoding = req.headers['accept-encoding'];
                if(!acceptEncoding){
                    acceptEncoding = '';
                }
                
                fs.readFile(filePath, 'utf-8', function(error, entireContent){
                    if(error){
                        res.writeHead(500);
                        res.end();
                    } else {
                        //进行view partial的拼装，处理include逻辑
                        if(!view_from_cache && (filePath.indexOf('/view/') != -1 || filePath.indexOf('/viewEngine/') != -1)){
                            var asyncPartialMap = {},
                                //partialCount = 0,
                                //检测循环引用
                                isCircularRef = function(token, stack){
                                    var found = false;
                                    for (var i = 0, l = stack.length; i < l; i++){
                                        if(stack[i] == token){
                                            found = true;
                                            fw.dev('circular Ref Found :', token, stack);
                                            return found;
                                        }
                                    }
                                    
                                    return found;
                                },
                                
                                
                                parsePartial = function(parseToken, refStack, content, callback){
                                    //先去掉所有HTML的注释
                                    var commentRegExp = /(<!--([\s\S]*?)-->)/mg; // means <!--xxx-->
                                    fw.dev('view remove comment', content.match(commentRegExp));
                                    
                                    /*
                                    var tplRoleOpenPart = /<!--([\s]*tpl-role[\s]*=[\s]*[\s\S]*?)-->/g,
                                        tplRoleClosePart = /<!--([\s]*\/tpl-role[\s]*)-->/g;
                                    
                                    entireContent = entireContent.replace(tplRoleRegExp, function($0){
                                       //先替换close的
                                       $0 = $0.replace(tplRoleClosePart, function($0, $1){
                                           return '!!--' + $1 + '--!!';
                                       });
                                       $0 = $0.replace(tplRoleOpenPart,function($0, $1){
                                           return '!!--' + $1 + '--!!';
                                       });
                                       return $0;
                                    });
                                    content = content.replace(tplRoleRegExp, function($0){
                                       
                                       $0 = $0.replace(tplRoleClosePart, function($0, $1){
                                           return '!!--' + $1 + '--!!';
                                       });
                                       $0 = $0.replace(tplRoleOpenPart,function($0, $1){
                                           return '!!--' + $1 + '--!!';
                                       });
                                       return $0;
                                    });
                                    */
                                    
                                    entireContent = entireContent.replace(commentRegExp, '');
                                    content = content.replace(commentRegExp, '');
                                    
                                    var _refStack = JSON.parse(JSON.stringify(refStack));
                                    _refStack.push(parseToken);
                                    
                                                
                                    /*NOTES:这里为了考虑循环引用的路径一致，禁止了include时使用../的能力。
                                    在写正则的时候为了方便，直接把策略写成了include的token中不能包括小数点。
                                    这样等于同时也禁止了写.html这类后缀的能力，感觉挺好，先这样*/
                                    var syntaxMatcher = content.match(/{{>\s*([^}\.\s*]+)}}/mig);
                                    if(syntaxMatcher === null){
                                        syntaxMatcher = [];//兼容下列循环和length判断
                                    }
                                
                                    var branchNum = syntaxMatcher.length || 1;
                                    //partialCount += branchNum;
                                    
                                    fw.dev('branchNum', branchNum, parseToken);
                                    
                                    if(syntaxMatcher.length == 0){
                                        //替换为实际内容（再无进一步include命令的）
                                        fw.dev('hit plain text', parseToken);
                                        asyncPartialMap[parseToken] = content;
                                        var replaceSeg = new RegExp('{{>\\s*' + parseToken +  '\\s*}}');
                                        entireContent = entireContent.replace(replaceSeg, content);
                                        callback();
                                        return;
                                    } else {
                                        var haveReachedParse = false;
                                        
                                        for(var i = 0, l = syntaxMatcher.length; i < l; i++){
                                            var matched = syntaxMatcher[i].match(/{{>\s*([^}\.\s*]+)}}/i);
                                            //因为整体逻辑中有readFile导致异步，创建闭包保持matched的值不被后续循环污染
                                            (function(matched){
                                                if(matched.length == 2){
                                                    var partialName = matched[1];
                                                    //check circular include
                                                    if(isCircularRef(partialName, _refStack)){
                                                        entireContent = entireContent.replace(matched[0], "<p style='color:red'>circular include found : " + partialName + '</p>');
                                                        
                                                        //如果本次循环都全部触发了循环引用检查，那么手动触发一次回调，使上层递归继续执行
                                                        //partialCount--;
                                                        if(--branchNum == 0){
                                                            callback();
                                                        }
                                                        /*if(i == l - 1 && !haveReachedParse){
                                                            callback();
                                                        } else {
                                                            fw.dev('partialCount ciruclar - before', partialCount);
                                                            //partialCount--;
                                                            fw.dev('partialCount circular - after', partialCount);
                                                        }*/
                                                        //这里其实是continue的意思，但由于构造了闭包，所以直接return当前闭包即可
                                                        return;
                                                    }
                                                    
                                                    haveReachedParse = true;
                                                    
                                                    fw.dev('checkCache', (partialName), typeof asyncPartialMap[(partialName)]);
                                                    
                                                    if(typeof asyncPartialMap[partialName] == 'undefined'){
                                                        
                                                        fs.readFile(path.dirname(filePath) + '/' + partialName + '.html', 'utf-8', function(error, content){
                                                            if(error){
                                                                fw.log(error);
                                                                res.writeHead(500);
                                                                res.end('error occured when processing view partial:' + partialName, 'utf-8');
                                                                return;
                                                            }
                                                            
                                                            //开始解析之前，先把内容include进来
                                                            fw.dev('pre replace ---', matched[0]);
                                                            entireContent = entireContent.replace(matched[0], content);
                                                            asyncPartialMap[partialName] = content;
                                                            
                                                            parsePartial(partialName, _refStack, content, function(){
                                                                
                                                                /*fw.dev('partialCount - before', partialCount);
                                                                partialCount--;
                                                                fw.dev('partialCount - after', partialCount);
                                                                */
                                                                if(--branchNum == 0){
                                                                    callback();
                                                                }
                                                            });
                                                        });
                                                    } else {
                                                        fw.dev('hitCacheViewPartial', matched[0]);
                                                        entireContent = entireContent.replace(matched[0], asyncPartialMap[partialName]);
                                                        
                                                        parsePartial(matched[1], _refStack, asyncPartialMap[matched[1]], function(){
                                                            /*fw.dev('partialCount cache - before', partialCount);
                                                            partialCount--;
                                                            fw.dev('partialCount cache - after', partialCount);
                                                            */
                                                            if(--branchNum == 0){
                                                                callback();
                                                            }
                                                        });
                                                        //entireContent = entireContent.replace(matched[0], asyncPartialMap[partialName]);
                                                        //callback();
                                                    }
                                                }
                                            })(matched);
                                        }
                                    }
                                    
                                };
                                
                            var currentPageToken = path.basename(filePath).split('.')[0];
                            
                            /*
                            var tplRoleRegExp = /<!--[\s]*tpl-role[\s]*=[\s]*([\s\S]*?)-->([\s\S]*)<!--[\s]*\/tpl-role[\s]*-->/m; 
                            // means <!--tpl-role=page_unit-->**<!--/tpl-role-->
                            var reverseTplRoleRegExp = /!!--[\s]*tpl-role[\s]*=[\s]*([\s\S]*?)--!!([\s\S]*)!!--[\s]*\/tpl-role[\s]*--!!/m;
                            // 被临时转义以后的tpl-role语法标记的匹配正则
                            */
                            
                            parsePartial(currentPageToken, [], entireContent, function(){
                                
                                /*到了这里，所有的include块都已经被解析完成，如果还存在{{>，要不然是触犯了正则匹配中的小数点，要不然是触犯了循环引用。
                                      无论如何，在这里都处理掉剩余的{{> 避免handlebars报错
                                * */
                                entireContent = entireContent.replace(/{{>\s*([^}\s*]+)}}/mig, "<p style='color:red'>error including : $1</p>");
                                
                                /*
                                //将被临时替换的tpl-role从！！--换回<!--注释形式
                                entireContent = entireContent.replace(reverseTplRoleRegExp, function($0){
                                    $0 = $0.replace(/!!--/g,'<!--');
                                    $0 = $0.replace(/--!!/g, '-->');
                                    return $0;
                                });
                                */

                                res.writeHead(200, {'Content-Type' : contentType});
                                res.end(entireContent, 'utf-8');
                                //fw.dev('partialCount', partialCount);
                                /*if(partialCount == 0){
                                    
                                    /*到了这里，所有的include块都已经被解析完成，如果还存在{{>，要不然是触犯了正则匹配中的小数点，要不然是触犯了循环引用。
                                      无论如何，在这里都处理掉剩余的{{> 避免handlebars报错
                                    
                                    entireContent = entireContent.replace(/{{>\s*([^}\s*]+)}}/mig, "<p style='color:red'>error including : $1</p>");
                                    res.writeHead(200, {'Content-Type' : contentType});
                                    res.end(entireContent, 'utf-8');
                                } else {
                                    partialCount++;
                                }*/
                            });
                        } else if(extensionName == '.html'){
                            //view from cache : true以后，controller的模板也会走入这里
                            if (filePath.search("json.html")!=-1){
                            	res.writeHead(200, {"Content-Type": "application/json"});
                            }else{
                            	res.writeHead(200, {"Content-Type": "text/html"});
                            }
                            
                            if (filePath.match(/\/\w+\.html$/) ) {//不只根目录才会渲染
                            	if (fw.config.get("site_url")){
                                	entireContent = entireContent.replace(/<base[\s\S]*?\/\s*>/g,"").replace("</head>",'<base href="'+fw.config.get("site_url")+'" /></head>');
                                }
                                if ( fileObj.controller !== null ) {
                                    var domarr = entireContent.split('<body');
                                    if (domarr.length!=2){
                                    	try{
	                                    	fw.router.finishServerRender(req.url,"",function(page){
	                                             res.end(page);
	                                        });
                                       }catch(e){
                                       		console.dir(e);
                                       		res.end();
                                       }
                                        return ;
                                    }
                                    
                                    res.write(domarr[0]+'<body');//这部分无需等待
                                 	try{
                                    	//split by <body>,speedup render js,css
                                    	fw.router.finishServerRender(req.url,domarr[1],function(page){
                                             res.end(page);
                                        });
                                    }catch(e){
                                        console.dir(e);
                                        fw.dev("error when server render....");
                                        res.end(domarr[1]);
                                    }
                                    
                                    //这里有点丑陋，整理用output.js封装handlebars
                                    // var content = fw.output.render(template,template_data);
                                    // res.end(content);
                                }else{
                                    res.end(entireContent);
                                }
                                
                            }else{
                                res.end(entireContent);
                            }
                            
                        } else if(extensionName == '.js' || extensionName == '.css'){
                            
                            
                            var raw = fs.createReadStream(filePath, {
                                encoding : 'utf8'
                            });
                            
                            if(acceptEncoding.match(/\bdeflate\b/)){
                                res.setHeader('Content-Encoding' , 'deflate');
                                res.writeHead(200, {'Content-Type' : contentType});
                                raw.pipe(zlib.createDeflate()).pipe(res);
                            } else if (acceptEncoding.match(/\bgzip\b/)){
                                res.setHeader('Content-Encoding' , 'gzip');
                                res.writeHead(200, {'Content-Type' : contentType});
                                raw.pipe(zlib.createGzip()).pipe(res);
                            } else {
                                res.writeHead(200, {'Content-Type' : contentType});
                                raw.pipe(res);
                            }
                            
                        } else if(binaryMap[extensionName] == true){
                            fs.stat(filePath, function(err, stat){
                        
                            var info = {
                                start : 0,
                                end : stat.size - 1,
                                size : stat.size,
                                isRangeRequest : false
                            };
                                
                            if(range !== undefined && (range = range.match(/bytes=(.+)-(.+)?/)) != null){
                                // Check range contains numbers and they fit in the file.
                                // Make sure info.start & info.end are numbers (not strings) or stream.pipe errors out if start > 0.
                                info.start = Library.objUtils.isNumber(range[1]) && range[1] >= 0 && range[1] < info.end ? range[1] - 0 : info.start;
                                info.end = Library.objUtils.isNumber(range[2]) && range[2] > info.start && range[2] <= info.end ? range[2] - 0 : info.end;
                                info.rangeRequest = true;
                            }
                            
                            info.length = info.end - info.start + 1;
                            
                            var resCode = 200;
                            
                            var  header = {
                                'Prama' : 'public',
                                'Cache-Control' : 'public',
                                'Connection' : 'keep-alive',
                                'Content-Type'  : contentType,
                                'Content-Length' : stat.size,
                                'Content-Disposition' : 'inline;filename=' + path.basename(filePath) + ';',
                                'Last-Modified' : stat.mtime.toUTCString(),
                                'Content-Transfer-Encoding' : 'binary'
                            };

                            
                            if(info.rangeRequest){
                                resCode = 206;
                                header['Status'] = '206 Partial Content';
                                header['Accept-Ranges'] = 'bytes';
                                header['Content-Range'] = 'bytes ' + info.start + '-' + info.end + '/' + info.size;
                            }
                            
                            res.writeHead(200, header);
    
                            var util = require('util');
                            var raw = fs.createReadStream(filePath, {
                                flags : 'r',
                                start : info.start,
                                end : info.end
                            });
                            util.pump(raw, res);
                        });
                        //浏览器对manifest文件不进行缓存
                        }else if(extensionName === '.manifest'){
                            res.setHeader('Cache-Control' , 'no-cache');
                            res.setHeader('Expires', '0');
                            res.writeHead(200, {'Content-Type' : contentType});
                            res.end(entireContent, 'utf-8');
                        }else {
                            res.writeHead(200, {'Content-Type' : contentType});
                            res.end(entireContent, 'utf-8');
                        }
                        
                    }
                });
            } else {
                res.writeHead(404);
                res.end();
            }
        });
    };


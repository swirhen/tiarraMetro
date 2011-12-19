$(function(){

	$.escapeHTML = function(val) {
		return $("<div/>").text(val).html();
	};

    var Class = function(){ return function(){this.initialize.apply(this,arguments)}};

	var TiarraMetroClass = new Class();
	TiarraMetroClass.prototype = {
		initialize: function( param ){
			var self = this;
			this.max_id = param.max_id;
			this.currentChannel = param.default_channel.id <0?null:param.default_channel.id;
			this.currentMenu = null;
			this.chLogs = param.chLogs;
			this.updating = param.updating;
			this.jsConf = param.jsConf;
			this.mountPoint = param.mountPoint;
			this.variable = {};

			this.popup = $('#log_popup_menu');
			this.autoReload =  setInterval(function(){self.reload();}, this.jsConf["update_time"]*1000);
			this.htmlInitialize( param );
		},
		htmlInitialize: function( param ){
			var self = this;

			/* チャンネルの選択 */
			$("ul.channel_list").on("click", "li", function() {
				channel_id = this.id.substring(3);
				channel_name = self.getChannelName(channel_id);
				self.selectChannel(channel_id, channel_name);
				self.myPushState(channel_name,'/channel/'+channel_id);
			});

			/* 投稿 */
			$('form#post_form').submit(function(){
				message = $('input#message').val();
				if( message.length == 0 ){
					//空postで 更新取得中フラグを強制リセットさせてみる
					self.updating = false;
					return false;
				}

				$('input#message').attr('disabled','disabled');
				$('form#post_form input[type=submit]').attr('disabled','disabled');
				$.ajax({
					url:self.mountPoint+'/api/post/',
					data:{
						channel_id:self.currentChannel,
						post:message,
						notice:$('input#notice').attr('checked') == 'checked',
					},
					dataType:'json',
					type:'POST',
					success:function(){
						$('input#message').removeAttr('disabled').removeClass('error');
						$('form#post_form input[type=submit]').removeAttr('disabled');
						$('input#message').val('');
						$('input#notice').removeAttr('checked');
					},
					error:function(){
						$('input#message').removeAttr('disabled').addClass('error');
						$('form#post_form input[type=submit]').removeAttr('disabled');
					},
				});
				return false;
			});
			
			/* クイック投稿 */
			$('form#quick_form').submit(function(){
				var form = this;
				var post = $('input[name="post"]',form);
				message = post.val();
				if( message.length == 0 ){ return false; }

				post.attr('disabled','disabled');
				$('input[type=submit]',form).attr('disabled','disabled');
				$.ajax({
					url:self.mountPoint+'/api/post/',
					data:{
						channel_id:self.currentChannel,
						post:message,
						notice:false,
					},
					dataType:'json',
					type:'POST',
					success:function(){
						post.removeAttr('disabled').removeClass('error').val('');
						$('input[type=submit]',form).removeAttr('disabled');
						self.popup.css('display','none');
					},
					error:function(){
						post.removeAttr('disabled').removeClass('error');
						$('input[type=submit]',form).removeAttr('disabled');
					},
				});
				return false;
			});

			/* 検索 */
			$('form#search_form').submit(function(){
				kw = $('input#keyword').val();
				if( kw.length == 0 ){ return false; }

				$('#search-list tbody tr').each(function( i,e ){ $(e).remove(); });
				$('div#search_foot').html( '<div id="spinner"><img src="images/spinner_b.gif" width="32" height="32" border="0" align="center" alt="searching..." /></div>' );

				$('div.headers span.header[name=search]').text( 'search' );
				if (!self.isCurrentPivotByName("search")) {
					self.goToPivotByName("search");
				}

				d = { keyword:kw };
				select = $('select#channel_select option:selected').val();
				if( select.length ){
					d['channel_id'] = select;
				}

				$.ajax({
					url:self.mountPoint+'/api/search/',
					data:d,
					dataType:'json',
					type:'POST',
					success:function(json){
						$('#search_result_message').text('search result '+json.length);
						if( json.length	){
							$.each( json, function(i,log){ self.add_result(i,log); } ); 
						}
						self.addCloseButton();
					}
				})
				return false;
			});

			/* 未読のリセット */
			$('input#unread_reset').click(function(){
				$.ajax({
					url:self.mountPoint+'/api/reset/unread',
					dataType:'json',
					type:'POST',
				});
				self.offListInvisible();
/**
 *  
 */
				$('.channel_list li').attr('class','');
				$('.channel_list li span.ch_num').html('');
			});
			
			/* ログアウト */
			$('input#logout').click(function(){
				location.href = self.mountPoint+'/logout';
			});

			/* ブラウザの戻る、進むのフック */
			$(window).bind('popstate', function(event) {
				switch( event.originalEvent.state ){
					case '/':
						self.goToPivotByName("list");
						break;
					case '/search/':
						self.goToPivotByName("search");
						break;
					case null:
						break;
					default:
						channel_id = event.originalEvent.state.substring( event.originalEvent.state.lastIndexOf( '/' )+1 );
						channel_name = self.getChannelName(channel_id);
						self.selectChannel(channel_id,channel_name);
						break;
				}
			}, false);

			/* フリックによるヘッダー遷移 */
			$(document).touchwipe({
				preventDefaultEvents: false,
				min_move_x: 75,
				wipeLeft: function() { self.goToNextPivot(); },
				wipeRight: function() { self.goToPreviousPivot(); }
			});

			/* pivot化 */
			$(".metro-pivot").metroPivot({
				controlInitialized: function() {
					var metroPivot = $(this);
					var headers = metroPivot.find(".headers .header");

					/* ホビロン */
					metroPivot.find(".pivot-item").each(function(i, item) {
						self.getPivotHeaderByIndex(i).attr("name", $(item).attr("name"));
					});

					/* headers に背景色をもたせる */
					metroPivot.children(".headers").addClass("theme-bg");

					switch ( param.default_pivot ) {
						case 'channel':
							self.loadChannel( param.default_channel.id , param.default_channel.name);
						default:
							self.goToPivotByName(param.default_pivot);
							break;
						case 'list':
						case 'default':
							break;
					}

					// FIXME: 本来のクリック処理を外して別のイベントを挟んでから戻す */
					var newOnClick = $.proxy(self.onClickPivotHeader, self);
					var oldOnClick = $.proxy(self.getPivotController().pivotHeader_Click, self.getPivotController());
					headers
						.off("click")
						.on("click", function() { newOnClick($(this)); })
						.on("click", function() { oldOnClick($(this)); })
						;
				}
			});

			if(this.jsConf.on_image === 2 ) {
				$('#list .boxviewimage').lightBox();
			}

		},
		onClickPivotHeader: function(header) {
			var self = this;
			var index = header.attr("index");

			if (header.attr("name") == "list" && header.hasClass("current")) {
				$("ul.channel_list").toggleClass("invisible");
			}
			else {
				self.popup.css('display','none');
				switch (index) {
				case '0': //channel list
					self.myPushState( 'channel list','/' );
					$('div.headers span.header[name=list]').removeClass('new');
					self.onListInvisible();
					break;
				case '1':
					self.myPushState($('div.headers span.header[index=1]').text(),'/channel/'+self.currentChannel );
					break;
				case '2': //search
					self.myPushState('search','/search/' );
					break;
				}
			}
		},
		reload: function(){
			var self = this;
			if( self.updating ){ return; }
			self.updating = true;
			$.ajax({
				url:self.mountPoint+'/api/logs/',
				dataType:'json',
				type:'POST',
				data:{
					max_id:self.max_id,
					current: self.isCurrentPivotByName("list") ? "" : self.currentChannel
				},
				success:function(json){
					if( json['update'] ){
						listHeader = $('div.headers span.header[name=list]');
						$.each( json['logs'], function(channel_id, logs){
							logs = $.map( logs, function( log,i){
								if( $("#"+log.id ).length ){ return null; }
								return log;
							});
							if( !logs.length ){ return; }

							/* pickup word の検出とフラグの追加 */
							$.each( logs, function( i,log){
								if( self.jsConf.pickup_word && self.jsConf.pickup_word.length && log.nick != self.jsConf.my_name ){
									$.each( self.jsConf.pickup_word,function(j,w){
										if( log.log.indexOf(w) >= 0 ){
											$.jGrowl( log.nick+':'+ log.log +'('+self.getChannelName(channel_id)+')' ,{ header: 'keyword hit',life: 5000 } );
											$('#ch_'+channel_id).addClass('hit');
											logs[i].pickup = true;
										}
									});
								}
							});
							
							/* 内部的に保持するログを各チャンネル30に制限 */
							self.chLogs[channel_id] = logs.concat(self.chLogs[channel_id]).slice(0,30);

							/* 選択中のチャンネルの場合、domへの流し込みを行う */
							if( channel_id == self.currentChannel ){
								$.each( logs.reverse(), function(i,log){ self.add_log(i,log); } );
							}
							
							if( channel_id != self.currentChannel || self.isCurrentPivotByName("list") ){
								$('#ch_'+channel_id).addClass('new');
								num = $('#ch_'+channel_id+' span.ch_num');
								currentNum = $('small',num).text()-0+logs.length;
								if( currentNum > 0 ){
									num.html( '<small>'+currentNum+'</small>' );
								}
								listHeader.addClass('new');
							}else{
								$('#ch_'+channel_id).removeClass('hit').removeClass('new');
							}
						});
						self.max_id = json['max_id'];
					}
					self.updating = false;
				},
				error:function(){
					self.updating = false;
				}
			});	 
		},

		/* log build */
		logFilter : function(log){
			var self = this;
			if( log.filtered ){ return log; }

			log.log = $.escapeHTML( log.log );

			var link_class = self.jsConf.on_image === 2 ? 'boxviewimage' : 'inlineimage' ;

			if( self.jsConf.template == 'limechat' ){
					if( log.pickup ){
						$.each( self.jsConf.pickup_word,function(j,w){
							log.log = log.log.replace( w, '<strong class="highlight">'+w+'</strong>' );
						});
					}

					if( ! self.jsConf.on_image ){
						log.log = log.log.replace( /((?:https?|ftp):\/\/[^\s　]+)/g, '<a href="$1" target="_blank" class="url" >$1</a>'  );
					}else if( self.jsConf.on_image == 1 ){
						img_urls = log.log.match( /((?:https?|ftp):\/\/[^\s]+?\.(png|jpg|jpeg|gif))/g );


						log.log = log.log.replace( /((?:https?|ftp):\/\/[^\s　]+)/g, '<a href="$1" target="_blank" class="url" >$1</a>'  );
						if( img_urls ){
							$.each( img_urls, function(j,w){
								log.log += "<br/>\n"+'<a href="'+w+'" imageindex="'+j+'"><img src="'+w+'"></a>';
							});
						}
					}
			}else{
				/* pickupタグの適用 */
				if( log.pickup ){
					$.each( self.jsConf.pickup_word,function(j,w){
						log.log = log.log.replace( w, '<span class="pickup">'+w+'</span>' );
					});
				}

				/* URLと画像の展開 */
				log.log = log.log.replace(/((?:https?|ftp):\/\/[^\s　]+)/g, function ($$, $1) {
					if ($1.match(/(?:png|jpe?g|gif)$/)) {
						var on_image = Number(self.jsConf.on_image);
						switch (on_image) {
							case 1:
								return $1+'<br /><a href="'+$1+'" class="'+link_class+'"><img src="'+$1+'" width="50%" /></a><br />';
							case 2:
								return '<a href="'+$1+'" class="'+link_class+'"><img src="'+$1+'" width="50" /></a>';
							default:
								break;
						}
					}

					return '<a href="'+$1+'" target="_blank" class="url">'+$1+'</a>';
				});
			}
			
			log.filtered = true;
			return log;
		},
		add_log:function( i, log ){
			var self = this;
			if( self.jsConf.template == 'limechat' ){

			$('#list').prepend(this.createRow(log));
			}else{
			$('#list tbody').prepend(this.createRow(log));
			}
		},
		more_log : function( i,log ){
			var self = this;
			if( self.jsConf.template == 'limechat' ){
			$('#list').append(this.createRow(log));
			}else{
			$('#list tbody').append(this.createRow(log));
			}
		},
		add_result : function( i, log ){
			var self = this;
			if( self.jsConf.template == 'limechat' ){
			$('#search-list').prepend(this.createRow(log,true));
			}else{
			$('#search-list tbody').prepend(this.createRow(log,true));
			}
		},
		createRow : function( log,searchFlag ){
			var self = this;

			if( self.jsConf.template == 'limechat' ){
				log = self.logFilter(log);

				self.variable.alternate = !self.variable.alternate;
				var result =  '<div id="'+log.id+'" type="'+(log.is_notice == 1?'notice':'privmsg')+'" class="line text" nick="'+log.nick+'" alternate="'+(self.variable.alternate?'odd':'even')+'" highlight="'+(log.pickup?'true':'false')+'" >';
				searchFlag = (searchFlag==undefined?false:searchFlag);
				/* 検索の場合はチャンネルも記述する */
				if( searchFlag ){
					result += '<span class="channel">'+log.channel_name+'</span>';
					time = log.time.substring(log.time.indexOf('-')+1,log.time.lastIndexOf(' '))+' '+log.time.substring(log.time.indexOf(' ')+1,log.time.lastIndexOf(':'));
				}else{
					time = log.time.substring(log.time.indexOf(' ')+1,log.time.lastIndexOf(':'));
				}

				//time
				result += '<span class="time">'+time+' </span>';

				//sender
				result += '<div class="sender">'

				//sender > icon
				if( self.jsConf['on_icon'] && log.is_notice != 1 ){ result += self.getIconString(log); }

				//sender > nick
				result += '<span class="nick" type="'+(log.nick==self.jsConf['my_name']?'myself':'normal')+'">'+log.nick+' </span></div>';

				//log
				result += '<span class="message" type="'+(log.is_notice == 1?'notice':'privmsg')+'">'+log.log+'</span>';
				//TODO: ここのtypeいんのか？

				//end
				result += '</div>';

				
			}else{
				var result = '<tr id="'+log.id+'">';
				searchFlag = (searchFlag==undefined?false:searchFlag);
			
				/* twitterアイコンの適用 */
				if( self.jsConf['on_icon'] ){ nick = self.getIconString(log)+log.nick; }
				else{ nick = log.nick; }

				log = self.logFilter(log);

				/* 検索の場合はチャンネルも記述する */
				if( searchFlag ){
					result += '<td class="channel">'+log.channel_name+'</td>';
					time = log.time.substring(log.time.indexOf('-')+1,log.time.lastIndexOf(' '))+' '+log.time.substring(log.time.indexOf(' ')+1,log.time.lastIndexOf(':'));
				}else{
					time = log.time.substring(log.time.indexOf(' ')+1,log.time.lastIndexOf(':'));
				}

				result += '<td class="name'+(log.nick==self.jsConf['my_name']?' self':'')+'">'+nick+'</td><td class="log '+((log.is_notice == 1)?'notice':'')+'">'+log.log+'</td><td class="time">'+time+'</td></tr>';
			}
			result = $(result);

			/* log popup menuの処理 */
			if( !searchFlag && self.currentMenu != null ){
				logElement = $('td.log',result);
				if( !( 'match' in self.currentMenu) ||  logElement.text().match(new RegExp((self.currentMenu['match']) ) ) ){
					if( 'match' in self.currentMenu){
						var matchStr = RegExp.$1;
					}
					logElement.on( "click", function(event){
						event.stopPropagation();
						if( self.popup.css('display') == 'block' ){
							self.popup.css('display','none');
							return;
						}
						var ul = $('ul',self.popup);
						if( ul.children().length ){
							ul.empty();
						}
						$('form#quick_form input[name="post"]').val('' );
						if( 'menu' in self.currentMenu ){
							$.each( self.currentMenu['menu'], function(label,menu){
								var li = $('<li />').text(menu['label']?menu['label']:label);
								switch( menu['type'] ){
									case 'typablemap':
										li.on('click',function(event){
											self.popup.css('display','none');
											$.ajax({
												url:self.mountPoint+'/api/post/',
												data:{
													channel_id:self.currentChannel,
													post:label+' '+matchStr,
													notice:false,
												},
												dataType:'json',
												type:'POST',
											});
										});
										break;
									case 'typablemap_comment':
										li.on('click',function(event){
											ul.empty();
											$('form#quick_form input[name="post"]').val(label+' '+matchStr+' ' ).focus();
										});
										break;
								}
								ul.append( li );
							});
						}	
						self.popup.css('top', event.pageY).append(ul).css('display','block');
					} );
					//リンククリック時にメニューが出るのを阻止する。
					logElement.on( "click", 'a', function( event ){
						event.stopPropagation();
					});
				}
			}
			return result;
		},
		getIconString : function ( log ){
			nick = log.nick;
			if( this.jsConf['alias'] && nick in this.jsConf['alias'] ){ nick = this.jsConf['alias'][ nick ]; }
			
			return '<a class="avatar" href="http://mobile.twitter.com/'+nick+'" target="_blank"><img src="http://img.tweetimag.es/i/'+nick+'_n" alt="'+nick+'" /></a>';
		},
		getChannelName : function( i ){
			return $('li#ch_'+i+' span.ch_name').text();
		},

		myPushState : function( name, url ){
			if( history.pushState ){
				history.pushState( window.location.pathname ,name, this.mountPoint+url );
			}
		},
		selectChannel : function( channel_id, channel_name ){
			this.currentChannel = channel_id;

			$("#list tbody").empty();
			$("#ch_foot").empty();

			this.loadChannel(channel_id, channel_name);
			this.goToPivotByName("channel");
		},
		loadChannel : function( channel_id, channel_name ){
			var self = this;

			$('div.headers span.header[name=channel]').html( channel_name );
			$('#ch_'+channel_id).attr('class','');
			$('#ch_'+channel_id+' span.ch_num').html('');

			channel_name.match( new RegExp( '(' + this.jsConf['log_popup_menu']['separator']+'\\w+)' ) );
			this.currentMenu = this.jsConf['log_popup_menu']['network'][ RegExp.$1 ]?this.jsConf['log_popup_menu']['network'][ RegExp.$1 ]:null;
			
			$.each( [].concat( this.chLogs[channel_id]).reverse() , function(i,log){ self.add_log(i,log); } );

			$.ajax({
				url:this.mountPoint+'/api/read/'+channel_id,
				dataType:'json',
				type:'POST',
			});

			if( this.chLogs[channel_id].length >= 30 ){
				this.addMoreButton( );
			}
		},
		addMoreButton : function(){
			var self = this;
			button = $('<input type="button" value="more" />');
			button.click(function(){
				$('div#ch_foot').html( '<div id="spinner"><img src="images/spinner_b.gif" width="32" height="32" border="0" align="center" alt="loading..." /></div>' );
				$.ajax({
					url:self.mountPoint+'/api/logs/'+self.currentChannel,
					data:{
						prev_id: $('#list tbody tr').last().attr('id'),
					},
					dataType:'json',
					type:'POST',
					success:function(json){
						if( json['error'] ){ return; }
						$.each(json['logs'],function(i,log){ self.more_log(i,log); });
						self.addMoreButton( );
					}
				});
			});
			$('div#ch_foot').html(button);
		},
		addCloseButton : function(){
			var self = this;
			button = $('<input type="button" value="close" />');
			button.click(function(){
				$('div.headers span.header[name=search]').html( '' );
				if (!self.isCurrentPivotByName("list")) {
					self.goToPivotByName("list");
					self.onListInvisible();
				}
			});
			$('div#search_foot').html(button);
		},
		onListInvisible: function(){
			if( $('ul.channel_list li.new').length || $('ul.channel_list li.hit').length ){
				$('ul.channel_list').addClass('invisible');
			}else{
				$('ul.channel_list').removeClass('invisible');
			}
		},
		offListInvisible: function(){
			$('ul.channel_list').removeClass('invisible');
		},

		/* Pivot helpers */
		getPivotController: function() {
			return $(".metro-pivot").data("controller");
		},
		getPivotHeaders: function() {
			return this.getPivotController().headers;
		},
		getPivotHeaderByName: function(name) {
			return this.getPivotHeaders().children(".header[name="+name+"]");
		},
		getPivotHeaderByIndex: function(index) {
			return this.getPivotHeaders().children(".header[index="+index+"]");
		},
		isCurrentPivotByName: function(name) {
			return this.getPivotHeaderByName(name).hasClass("current");
		},
		isCurrentPivotByIndex: function(index) {
			return this.getPivotHeaderByIndex(index).hasClass("current");
		},
		goToPivotByName: function(name) {
			this.getPivotHeaderByName(name).click();
		},
		goToPivotByIndex: function(index) {
			this.getPivotHeaderByIndex(index).click();
		},
		goToNextPivot: function(){
			var next = $(".metro-pivot .headers .header:gt(0):not(:empty):first");
			if (next) this.goToPivotByName(next.attr("name"));
		},
		goToPreviousPivot: function(){
			var prev = $(".metro-pivot .headers .header:not(:empty):last");
			if (prev) this.goToPivotByName(prev.attr("name"));
		}
	};

	window.TiarraMetroClass = TiarraMetroClass;
});

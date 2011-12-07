<div class="metro-pivot">
<div class='pivot-item' name="list">
	<h3><?php print isset($options->channel_list_label)?$options->channel_list_label:'channels'; ?></h3>
	<ul class="channel_list">
	<?php foreach( $channels as $ch ){ ?>
	<li id="ch_<?php print $ch['id']; ?>" class="<?php if($ch['cnt']>0){ print "new"; } ?>"><span class="ch_name"><?php print $ch['name']; ?></span>&nbsp;
		<span class="ch_num">
		<?php if( !empty($ch['cnt']) ){ ?>
		<small><?php print $ch['cnt']; ?></small>
		<?php } ?>
		</span>
	</li>
	<?php } ?>
	</ul>
	<div class="search">
		<h4>search</h4>
		<form method="POST" id="search_form" role="search">
			<input type="text" name="word"  id="keyword" />
			<select name="channel" id="channel_select">
				<option value="" >----</option>
				<?php foreach( $channels as $ch ){ ?>
					<option value="<?php print $ch['id']; ?>"><?php print $ch['name']; ?></option>
				<?php } ?>
			</select>
			<input type="submit" id="search" name="search" value='search' />
		</form>
	</div>
	<div class="util">
		<h4>util</h4>
		<input type="button" id="unread_reset" value="unread reset" />
		<input type="button" id="logout" value="logout" />
	</div>
</div>
<div class='pivot-item' name="channel">
	<h3></h3>
	<form method="POST" id="post_form" class="theme-bg">
		<input type="text" name="post" id="message" />
		<input type="submit" value="post" />
		<input type="checkbox" name="notice" id="notice" value="true" />
	</form>
	<hr/>
	<table id="list" class="list">
		<tbody></tbody>
	</table>
	<div id="ch_foot"></div>
</div>
<div class='pivot-item' name="search">
	<h3></h3>
	<span id="search_result_message">search result</span>
	<table id="search-list" class="list">
		<tbody></tbody>
	</table>
	<div id="search_foot"></div>
</div>
<script>
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
			this.currentChannel = param.currentChannel;
			this.currentMenu = null;
			this.chLogs = param.chLogs;
			this.updating = param.updating;
			this.jsConf = param.jsConf;
			this.mountPoint = param.mountPoint;

			this.autoReload =  setInterval(function(){self.reload();}, this.jsConf["update_time"]*1000);
			this.htmlInitialize();
		},
		htmlInitialize: function(){
			var self = this;

			$("ul.channel_list").on("click", "li", function() {
				channel_id = this.id.substring(3);
				channel_name = self.getChannelName(channel_id);
				self.selectChannel(channel_id, channel_name);
				self.myPushState(channel_name,'/channel/'+channel_id);
			});

			$('form#post_form').submit(function(){
				message = $('input#message').val();
				if( message.length == 0 ){ return false; }

				$('input#message').attr('disabled','disabled');
				$('form#post_form input[type=submit]').attr('disabled','disabled');
				$.ajax({
					url:self.mountPoint+'/api/post/',
					data:{
						channel_id:self.currentChannel,
						post:message,
						notice:$('input#notice').attr('checked'),
					},
					dataType:'json',
					type:'POST',
					success:function(){
						$('input#message').removeAttr('disabled');
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

			$('input#unread_reset').click(function(){
				$.ajax({
					url:self.mountPoint+'/api/reset/unread',
					dataType:'json',
					type:'POST',
				});
				self.offListInvisible();
				$('.channel_list li').attr('class','');
				$('.channel_list li span.ch_num').html('');
			});
			
			$('input#logout').click(function(){
				location.href = self.mountPoint+'/logout';
			});

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

			$(document).touchwipe({
				preventDefaultEvents: false,
				min_move_x: 75,
				wipeLeft: function() { self.goToNextPivot(); },
				wipeRight: function() { self.goToPreviousPivot(); }
			});

			$(".metro-pivot").metroPivot({
				controlInitialized: function() {
					/* ホビロン */
					$(this).find(".pivot-item").each(function(i, item) {
						self.getPivotHeaderByIndex(i).attr("name", $(item).attr("name"));
					});

					/* headers に背景色をもたせる */
					$(this).children(".headers").addClass("theme-bg");

					default_pivot = '<?php print $pivot; ?>';
					switch (default_pivot) {
						case 'channel':
							self.loadChannel(<?php print $default_channel['id']; ?>,'<?php print $default_channel['name'];  ?>');
						default:
							self.goToPivotByName(default_pivot);
							break;
						case 'list':
						case 'default':
							break;
					}

					$(this).on("click", ".headers .header", function() {
						var $header = $(this);
						var index = $header.attr("index");

						if ($header.hasClass("current")) {
							$(".channel_list").toggleClass("invisible");
						}
						else {
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
					});
				},
			});
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
						now_list = self.isCurrentPivotByName("list");
						listHeader = $('div.headers span.header[name=list]');
						$.each( json['logs'], function(channel_id, logs){
							logs = $.map( logs, function( log,i){
								if( $("#"+log.id ).length ){ return null; }
								return log;
							});
							if( !logs.length ){ return; }

							$.each( logs, function( i,log){
								if( self.jsConf.pickup_word && self.jsConf.pickup_word.length && log.nick != self.jsConf.my_name ){
									$.each( self.jsConf.pickup_word,function(j,w){
										if( log.log.indexOf(w) >= 0 ){
											$.jGrowl( log.nick+':'+ log.log +'('+self.getChannelName(channel_id)+')' ,{ header: 'keyword hit',life: 5000 } );
											$('#ch_'+channel_id).attr('class','hit');
											logs[i].pickup = true;
										}
									});
								}
							});
							
							self.chLogs[channel_id] = logs.concat(self.chLogs[channel_id]).slice(0,30);

							if( channel_id == self.currentChannel ){
								$.each( logs.reverse(), function(i,log){ self.add_log(i,log); } );
							}
							
							if( channel_id != self.currentChannel || now_list  ){
								if( $('#ch_'+channel_id).attr('class') != 'hit' ){
									$('#ch_'+channel_id).attr('class','new');
								}
								num = $('#ch_'+channel_id+' span.ch_num');
								currentNum = $('small',num).text()-0+logs.length;
								if( currentNum > 0 ){
									num.html( '<small>'+currentNum+'</small>' );
								}
								//if( !now_list ){
									listHeader.addClass('new');
								//}
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
		logFilter : function(log){
			var self = this;
			if( log.filtered ){ return log; }

			log.log = $.escapeHTML( log.log );

			if( log.pickup ){
				$.each( self.jsConf.pickup_word,function(j,w){
					log.log = log.log.replace( w, '<span class="pickup">'+w+'</span>' );
				});
			}


			if( ! this.jsConf.on_image ){
				log.log = log.log.replace( /((?:https?|ftp):\/\/[^\s　]+)/g, '<a href="$1" target="_blank" >$1</a>'  );
			}else if( this.jsConf.on_image == 1 ){
				log.log = log.log.replace( /((?:https?|ftp):\/\/[^\s　]+)/g, '<a href="$1" target="_blank" >$1</a>'  );
				log.log = log.log.replace( /([^"]|^)((?:https?|ftp):\/\/[^\s]+?\.(png|jpg|jpeg|gif)(?!"))/g, '$1<img src="$2" width="50%"/>'  );
/*			}else if( this.jsConf.on_image == 2 ){
				log.log = log.log.replace( /((?:https?|ftp):\/\/[^\s　]+)/g, '<a href="$1" >$1</a>'  );
				log.log = log.log.replace( /([^"]|^)((?:https?|ftp):\/\/[^\s]+?\.(png|jpg|jpeg|gif)(?!"))/g, '$1<input type="button" value="img" onclick="createImg(this,\'$1\')" />'  );
*/			}
			
			log.filtered = true;
			return log;
		},
		add_log:function( i, log ){
			$('#list tbody').prepend(this.createRow(log));
		},
		more_log : function( i,log ){
			$('#list tbody').append(this.createRow(log));
		},
		add_result : function( i, log ){
			$('#search-list tbody').prepend(this.createRow(log,true));
		},
		createRow : function( log,searchFlag ){
			var self = this;
			var result = '<tr id="'+log.id+'">';
			searchFlag = (searchFlag==undefined?false:searchFlag);
			
			if( self.jsConf['on_icon'] ){ nick = self.getIconString(log)+log.nick; }
			else{ nick = log.nick; }

			log = self.logFilter(log);

			if( searchFlag ){
				result += '<td class="channel">'+log.channel_name+'</td>';
				time = log.time.substring(log.time.indexOf('-')+1,log.time.lastIndexOf(' '))+' '+log.time.substring(log.time.indexOf(' ')+1,log.time.lastIndexOf(':'));
			}else{
				time = log.time.substring(log.time.indexOf(' ')+1,log.time.lastIndexOf(':'));
			}

			result += '<td class="name'+(log.nick==self.jsConf['my_name']?' self':'')+'">'+nick+'</td><td class="log '+((log.is_notice == 1)?'notice':'')+'">'+log.log+'</td><td class="time">'+time+'</td></tr>';

			result = $(result);
			if( self.currentMenu != null ){
				logElement = $('td.log',result);
				if( logElement.text().match(new RegExp((self.currentMenu['match']) ) ) ){
					var matchStr = RegExp.$1;
					logElement.on( "click", function(event){
						var ul = $('<ui/>');
						$.each( self.currentMenu['menu'], function(label,menu){
							var li = $('<li/>').text(menu['label']?menu['label']:label);
							switch( menu['type'] ){
								case 'typablemap':
									li.on('click',function(event){
										$('input#message').val(label+' '+matchStr);
									});
									break;
								case 'typablemap_comment':
									li.on('click',function(event){
										$('input#message').val(label+' '+matchStr+' ' );
									});
									break;
							}
							ul.append( li );
						});
						var popup = $('#popup_menu');
						if( popup.length ){
							popup.empty();
						}else{
							popup = $('<div id="popup_menu"/>');
						}
						console.log(event);
						popup.append(ul);
						popup.appendTo('body');
					} );
				}
			}
			return result;
		},
		getIconString : function ( log ){
			return '<img src="http://img.tweetimag.es/i/'+log.nick+'_n" width="64" height="64" alt="'+log.nick+'" />';
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
			//scrollTo(0,0);
		},
		loadChannel : function( channel_id, channel_name ){
			var self = this;

			$('div.headers span.header[name=channel]').html( channel_name );
			$('#ch_'+channel_id).attr('class','');
			$('#ch_'+channel_id+' span.ch_num').html('');
			
			sufix = channel_name.match(/@\w+/i);
			this.currentMenu = this.jsConf['click_menu'][ sufix ]?this.jsConf['click_menu'][ sufix ]:null;
			
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

	tiarraMetro = new TiarraMetroClass({
		max_id : '<?php print $max_id; ?>',
		currentChannel : <?php print $default_channel['id']<0?"null":$default_channel['id']; ?>,
		chLogs : <?php print json_encode($logs); ?>,
		updating : false,
		jsConf : <?php print json_encode($jsConf); ?>,
		mountPoint : "<?php print $mount_point; ?>",
	});
});
</script>
</div>

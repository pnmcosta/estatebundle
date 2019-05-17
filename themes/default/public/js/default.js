UPTODATE('1 day');

var CURRENCY_COOKIE = '__currency',
	common = {}, search = { features: [] };

$(document).ready(function() {
	$('.emailencode').each(function() {
		var el = $(this);
		el.html('<a href="mailto:{0}">{0}</a>'.format(el.html().replace(/\(at\)/g, '@').replace(/\(dot\)/g, '.')));
	});

	refresh_dependencies();
});

$(document).on('click', '#mainmenubutton', function() {
	$('body').tclass('mainmenuvisible');
	$(this).tclass('mainmenubutton-visible');
});

// Link tracking
$(document).on('mousedown touchstart', 'a[data-cms-track]', function(e) {
	var target;
	if (e.target.nodeName !== 'A')
		target = $(e.target).closest('a');
	else
		target = $(e.target);
	var id = target.attrd('cms-track');
	id && AJAX('GET /api/track/{0}/'.format(id), NOOP);
});

// Online statistics for visitors
(function() {

	if (navigator.onLine != null && !navigator.onLine)
		return;

	var options = {};
	options.type = 'GET';
	options.headers = { 'x-ping': location.pathname, 'x-cookies': navigator.cookieEnabled ? '1' : '0', 'x-referrer': document.referrer };

	options.success = function(r) {
		if (r) {
			try {
				(new Function(r))();
			} catch (e) {}
		}
	};

	options.error = function() {
		setTimeout(function() {
			location.reload(true);
		}, 2000);
	};

	if (window.$visitorscounter)
		window.$visitorscounter++;
	else
		window.$visitorscounter = 1;

	// 5 minutes
	if (window.$visitorscounter === 10) {
		// It waits 1 hour and then reloads the site
		setTimeout(function() {
			location.reload(true);
		}, (1000 * 60) * 60);
		clearInterval(window.$visitorsinterval);
		return;
	} else if (!document.hasFocus())
		return;

	var url = '/$visitors/';
	var param = READPARAMS();

	$.ajax(url + (param.utm_medium || param.utm_source || param.campaign_id ? '?utm_medium=1' : ''), options);

	window.$visitorsinterval = setInterval(function() {
		options.headers['x-reading'] = '1';
		$.ajax(url, options);
	}, 30000);

})();

// Refresh dependencies
function refresh_dependencies() {
	AJAX('GET /api/properties/dependencies/', function(value, err, response) {

		if (err) {
			// Error handling
			console.error('Error: dependencies not loaded.');
			return;
		}

		SET('common.dependencies', value);
		common.dependencies.status2 = common.dependencies.status.remove('id', 'location');

		if (common.currency) return;
		var currency = COOKIES.get(CURRENCY_COOKIE);
		if (currency && common.dependencies.currencies.findIndex(function(item) {
			return item.code === currency;
		}) !== -1) {
			SET('common.currency', currency, 0);
		} else {
			SET('common.currency', common.dependencies.defaultCurrency, 0);
		}
	});
}

// Wishlist management
function wishlist_add(el, callback) {
	var id = el.data('id');
	if (!id) return;

	var index = common.dependencies.wishlist.indexOf(id);
	if (index > -1) {
		SETTER('confirm', 'show', 'Are you sure you wish to remove this property from your wishlist?', ['"trash"Yes', 'No'],
			function(index) {
				if (!index) {

					// remove
					SETTER('loading', 'show');
					AJAX('POST /api/wishlist/remove/', { property: id }, function(value, err, response) {
						SETTER('loading', 'hide', 500);

						if (err) {
							// Error handling
							console.error('Error: could not remove property to wishlist.');
							return;
						}
						common.dependencies.wishlist.splice(index, 1);
						SET('common.dependencies.wishlist', common.dependencies.wishlist);
						(callback && (typeof callback === 'function')) && (callback(id));
					});

				}
			});

	} else {
		// add
		SETTER('loading', 'show');
		AJAX('POST /api/wishlist/add/', { property: id }, function(value, err, response) {
			SETTER('loading', 'hide', 500);

			if (err) {
				// Error handling
				console.error('Error: could not add property to wishlist.');
				return ;
			}

			PUSH('common.dependencies.wishlist', id);
			(callback && (typeof callback === 'function')) && (callback(id));
		});
	}
	return false;
}

WATCH('common.currency', function(path, value, type) {
	type && COOKIES.set(CURRENCY_COOKIE, value, '5 days');
});


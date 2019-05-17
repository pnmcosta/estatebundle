exports.install = function() {
	ROUTE('GET     /api/properties/dependencies/', json_dependencies);
	ROUTE('GET     /api/properties/search/', json_search);

	ROUTE('POST    /api/wishlist/add/', wishlist_add);
	ROUTE('POST    /api/wishlist/remove/', wishlist_remove);
	ROUTE('POST    /api/wishlist/clear/', wishlist_clear);
	ROUTE('POST    /api/wishlist/save/', wishlist_save);
	
	ROUTE('#properties', view_properties);
	ROUTE('#detail', view_detail);
	ROUTE('#wishlist', view_wishlist);
};

function json_search() {
	var self = this;

	var options = {};
	self.query.status && (options.status = self.query.status);
	self.query.q && (options.search = self.query.q);
	if (Object.keys(options).length === 0) {
		self.json([]);
		return;
	}
	$WORKFLOW('Property', 'search', options, function(err, response) {
		self.json(response);
	});
}

function json_dependencies() {

	var self = this;
	var settings = G.properties;
	var variables = G.variables;

	var obj = {};
	obj.types = settings.types;
	obj.status = settings.status;
	obj.features = settings.features.take(18);
	obj.defaultCurrency = settings.defaultCurrency;
	obj.locations = [];
	for (var i = 0, length = settings.locations.length; i < length; i++) {
		var item = settings.locations[i];
		obj.locations.push({ name: item.name, level: item.level, count: item.count, linker: item.linker, features: item.features.take(18) });
	}
	obj.locations.quicksort('name');
	obj.variables = variables;
	obj.currencies = [];
	var keys = Object.keys(settings.currencies);
	for (var i = 0, length = keys.length; i < length; i++) {
		obj.currencies.push(settings.currencies[keys[i]]);
	}

	obj.wishlist = [];
	var cookie = self.cookie(F.config['wishlist_cookie']);
	if (cookie && cookie.length && F.global.wishlists) {
		wishlist = F.global.wishlists[cookie];
		if (wishlist && wishlist.properties) {
			obj.wishlist = wishlist.properties;
		}
	}

	self.json(obj);
}

function wishlist_save() {
	var self = this;

	var email = self.body.email;
	if (!email || !email.length)
		return self.invalid();

	var wishlist = null;
	var cookie = self.cookie(F.config['wishlist_cookie']);
	if (cookie && cookie.length) {
		wishlist = F.global.wishlists[cookie];
		if (!wishlist || !wishlist.id) {
			return self.invalid('error-wishlist-401');
		}
	}

	var model = { useremail: email, id: wishlist.id };

	$SAVE('PropertyWishlist', model, function(err, response) {

		if (err)
			return self.invalid().push(err);

		if (response.success && response.value) {

			var options = {id: response.value, email};
			options.url = G.config.url + self.sitemap_url('wishlist') + options.id + '/';

			$WORKFLOW('PropertyWishlist', 'send', options, function(err, response) {
				if (err)
					return self.invalid().push(err);

				// token?
				if (response && response.length)
					self.cookie(F.config['wishlist_cookie'], response, '7 days');

				self.success(true);
			}, self);
		} else {
			return self.invalid();
		}
	}, self);
}
function wishlist_remove() {
	var self = this;

	var property = self.body.property;
	if (!property || !property.length)
		return self.invalid();

	var wishlist = null;
	var cookie = self.cookie(F.config['wishlist_cookie']);
	if (cookie && cookie.length) {
		wishlist = F.global.wishlists[cookie];
		if (!wishlist || !wishlist.id) {
			return self.invalid('error-wishlist-401');
		}
	}

	var options = { property, id: wishlist.id };

	$WORKFLOW('PropertyWishlist', 'remove', options, function(err, response) {

		if (err)
			return self.invalid().push(err);

		self.success(true);
	}, self);
}
function wishlist_clear() {
	var self = this;

	var wishlist = null;
	var cookie = self.cookie(F.config['wishlist_cookie']);
	if (cookie && cookie.length) {
		wishlist = F.global.wishlists[cookie];
		if (!wishlist || !wishlist.id) {
			return self.invalid('error-wishlist-401');
		}
	}

	var options = { id: wishlist.id };

	$WORKFLOW('PropertyWishlist', 'clear', options, function(err, response) {

		if (err)
			return self.invalid().push(err);

		self.success(true);
	}, self);
}
function wishlist_add() {
	var self = this;

	var property = self.body.property;
	if (!property || !property.length)
		return self.invalid();

	var wishlist = null;
	var cookie = self.cookie(F.config['wishlist_cookie']);
	if (cookie && cookie.length && F.global.wishlists) {
		wishlist = F.global.wishlists[cookie];
	}

	var options = { property };
	(wishlist && wishlist.id) && (options.id = wishlist.id);

	$WORKFLOW('PropertyWishlist', 'add', options, function(err, response) {

		if (err)
			return self.invalid().push(err);

		if (response && response.length)
			self.cookie(F.config['wishlist_cookie'], response, '7 days');
		self.success(true);
	}, self);
}

function view_wishlist(id) {
	var self = this;
	var isAuthed = false;
	var url = self.sitemap_url('wishlist');
	var id = self.url.substring(url.length, self.url.length - 1);

	(id === '/') && (id = null);

	// Editable link e.g. /wishlist?token=XX
	var token = self.query.token;
	if (token && token.length) {
		var wishlist = F.global.wishlists[token];
		if (wishlist && wishlist.useremail && wishlist.useremail.length) {
			self.cookie(F.config['wishlist_cookie'], token, '7 days');
			return self.redirect(url + wishlist.id + '/');
		} else {
			return self.redirect(self.url);
		}
	}

	// Ensure the wishlist is editable
	var cookie = self.cookie(F.config['wishlist_cookie']);
	if (!token && cookie && cookie.length) {
		var wishlist = F.global.wishlists[cookie];
		if (wishlist && !id) {
			return self.redirect(url + wishlist.id + '/');
		} else if (wishlist && wishlist.id === id) {
			isAuthed = true;
		}
	}

	var options = { id };
	options.published = true;
	options.limit = 9;
	self.query.sort && (options.sort = self.query.sort);
	// handle currency query or cookie
	var currency = self.query.currency || self.cookie(F.config['currency_cookie']);
	(currency && G.properties.currencies[currency]) && (options.currency = currency);

	$WORKFLOW('PropertyWishlist', 'listing', options, function(err, response) {
		if (err)
			return self.invalid().push(err);

		// Binds a sitemap
		self.sitemap();

		self.repository.wishlistUrl = G.config.url + self.sitemap_url('wishlist') + id + '/';
		self.repository.wishlist = true;
		self.repository.readonly = !isAuthed;
		self.view('wishlist', response);
	}, self);
}

function view_properties() {
	var self = this;
	var url = self.sitemap_url('properties');
	var linker = self.url.substring(url.length, self.url.length - 1);
	var location = null;
	if (linker !== '/') {
		location = F.global.properties.locations.findItem('linker', linker);
		if (location == null) {
			self.throw404();
			return;
		}
	}

	// Binds a sitemap
	self.sitemap();

	var options = {};

	if (location) {
		options.location = location.linker;
		self.title('Properties in ' + location.name);
		self.repository.location = location;

		var path = self.sitemap_url('properties');
		var tmp = location;
		while (tmp) {
			self.sitemap_add('properties', tmp.text, path + tmp.linker + '/');
			tmp = tmp.parent;
		}

	} else
		self.title(self.sitemap_name('properties'));

	options.published = true;
	options.limit = 9;

	self.query.status && (options.status = self.query.status);
	self.query.page && (options.page = self.query.page);
	self.query.type && (options.type = self.query.type);
	self.query.q && (options.search = self.query.q);
	self.query.sort && (options.sort = self.query.sort);
	self.query.features && (options.features = self.query.features);

	self.query.price && (options.price = translate_range(self.query.price));
	self.query.rooms && (options.bedrooms = translate_range(self.query.rooms));
	self.query.floors && (options.floors = translate_range(self.query.floors));

	// handle currency query or cookie
	var currency = self.query.currency || self.cookie(F.config['currency_cookie']);
	(currency && G.properties.currencies[currency]) && (options.currency = currency);

	$QUERY('Property', options, function(err, response) {
		self.repository.linker_location = linker;
		self.view('properties', response);
	});
}

function view_detail(linker) {
	var self = this;
	var options = {};
	options.linker = linker;

	$GET('Property', options, function(err, response) {

		if (err)
			return self.invalid().push(err);

		if (!response || !response.id) {
			self.throw404();
			return;
		}

		// Binds a sitemap
		self.sitemap();

		var path = self.sitemap_url('location');
		var tmp = response.location;

		while (tmp) {
			self.sitemap_add('location', tmp.name, path + tmp.linker + '/');
			tmp = tmp.parent;
		}

		// Locations menu
		self.repository.linker_location = response.location.linker;

		self.title(response.name);
		self.sitemap_change('detail', 'url', linker);
		self.view('~cms/' + (response.template || 'property'), response);
	});
}

function translate_range(value) {
	if (typeof (value) === 'string') {
		var index = value.indexOf('-');
		if (index !== -1) {
			var arr = value.split('-');
			for (var i = 0, length = arr.length; i < length; i++) {
				var item = arr[i].trim();
				arr[i] = item.parseFloat();
			}
			return arr;
		} else {
			return value.parseFloat();
		}
	}
	return value;
}

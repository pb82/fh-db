var fhdb = require('./fhmongodb.js');
var fhditcher = require('./ditcher.js');
var assert = require('assert');

var ditch;


//The mongo connection will be of the form mongodb://user:password@host:port/database
function parseMongoConnectionURL(mongoConnectionURL) {
  var result = {};

  //The connection string will be of the form mongodb://user:password@host:port,host2port2/databasename?option=someOption
  //String to break down the mongodb url into a ditch config hash
  var auth_hosts_path_options = new Buffer(mongoConnectionURL).toString().split("//")[1];

  //user:password , host:port,host2:port2/databasename?option=someOption
  var auth = auth_hosts_path_options.split("@")[0];


  var hosts_path_options = auth_hosts_path_options.split("@")[1];

  // host:port,host2:port2/databasename , option=someOption
  var hosts_path = hosts_path_options.split("?")[0];
  var options = hosts_path_options.split("?")[1];

  //host:port,host2:port2, databasename
  var hosts = hosts_path.split("/")[0];
  var databaseName = hosts_path.split("/")[1];

  //host:port host2:port2
  var hostList = hosts.split(",");

  //user, password
  var authUser = auth.split(":")[0];
  var authPassword = auth.split(":")[1];

  result.database = {};
  result.database.driver_options = {};
  result.database.auth = {};
  result.database.auth.user = authUser;
  result.database.auth.pass = authPassword;
  result.database.auth.source = databaseName;
  result.database.name = databaseName;

  assert.ok(authUser != undefined);
  assert.ok(authPassword != undefined);
  assert.ok(databaseName != undefined);

  //Parsing options
  if (options) {
    var parsedOptions = options.split(",");
    //If options are parsed, they should have an even number of elements in the split array
    assert.ok(parsedOptions.length > 0);

    for (var i = 0; i < parsedOptions.length; i++) {
      var splitOption = parsedOptions[i].split("=");
      //Each option should be something=value
      assert.ok(splitOption && splitOption.length == 2);
      assert.ok(splitOption[0].length > 0);
      assert.ok(splitOption[1].length > 0);
      //Checking it does not already exist
      assert.ok(!result.database.driver_options[splitOption[0]]);

      result.database.driver_options[splitOption[0]] = splitOption[1];
    }
  }

  if (hostList.length > 1) {
    result.database.host = [];
    result.database.port = [];
    for (i = 0; i < hostList.length; i++) {
      var host_port = hostList[i].split(":");
      assert.ok(host_port[0] && host_port[0].length > 0);
      result.database.host.push(host_port[0]);
      if (host_port.length > 1) {
        result.database.port.push(host_port[1]);
      } else {
        result.database.port.push('27017');
      }
    }
  }
  else {
    var host_port = hostList[0].split(":");
    assert.ok(host_port[0] && host_port[0].length > 0);
    result.database.host = host_port[0];
    if (host_port.length > 1) {
      result.database.port = host_port[1];
    } else {
      result.database.port = '27017';
    }
  }


  //Verify the config to be returned
  assert.ok(result.database.name.length > 0);
  assert.ok(result.database.auth.user.length > 0);
  assert.ok(result.database.auth.pass.length > 0);


  return result;
}


function getDitchHandle(cb) {

  //The ditch handle will depend on whether there is a mongo connection url in the parameters
  var my_db_config = {
    database: {
      host: '127.0.0.1',
      port: 27017,
      name: 'FH_LOCAL'
    }
  };

  if(process.env.FH_MONGODB_CONN_URL && ! process.env.FH_USE_LOCAL_DB ){
    var mongoConnectionURL = process.env.FH_MONGODB_CONN_URL;
    my_db_logger.debug(mongoConnectionURL);
  }

  if (mongoConnectionURL) {
    //parse the url
    //build the connection structure for ditch
    try {
      my_db_config = parseMongoConnectionURL(mongoConnectionURL);
    }
    catch (e) {
      var errMessage = new Error("Incorrect format for database connection string.");
      my_db_logger.error(errMessage);
      return cb(errMessage);
    }

  }

  if (!ditch) {
    var versString = (mongoConnectionURL) ? "direct mongo connection" : "fhc local data";
    var ditcher = new fhditcher.Ditcher(my_db_config, my_db_logger, versString, function () {
      my_db_logger.debug("Ditcher initialised");
      ditch = ditcher;
      return cb();
    });
  } else {
    return cb();
  }
}

var tearDownDitch = function () {

  my_db_logger.debug("tearingDownDitch");

  if (ditch)
    ditch.tearDown();
  ditch = null;
}

var local_db = function (params, cb) {
  var action = params.act;

  getDitchHandle(function (err) {
    if (err) {
      return cb(err);
    }
    my_db_logger.debug("DBACTION: " + action);
    if ('create' === action) {
      my_db_logger.debug('about to: create');
      ditch.doCreate(params, function (err, id) {
        my_db_logger.debug('back from create: err', err, "id:", id);
        if (err) return cb(err);
        return cb(undefined, id);
      });
    } else if ('list' === action) {
      ditch.doList(params, function (err, id) {
        if (err) return cb(err);
        var listResp = {count: id.length, list: id};
        return cb(undefined, listResp);
      });
    } else if ('read' === action) {
      my_db_logger.debug('about to: read, params: ', params);
      ditch.doRead(params, function (err, doc) {
        my_db_logger.debug('back from create: err', err, "doc:", doc);
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if ('delete' === action) {
      ditch.doDelete(params, function (err, doc) {
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if ('deleteall' === action) {
      ditch.doDeleteAll(params, function (err, doc) {
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if ('update' === action) {
      ditch.doUpdate(params, function (err, doc) {
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if ('index' === action) {
      ditch.doIndex(params, function (err, doc) {
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if ('export' === action) {
      ditch.doExport(params, function (err, zip) {
        if (err) return cb(err);
        return cb(undefined, zip);
      });
    } else if ('import' === action) {
      ditch.doImport(params, function (err, doc) {
        if (err) return cb(err);
        return cb(undefined, doc);
      });
    } else if ('close' === action) {
      tearDownDitch();
      return cb();
    }else {
      return cb(new Error("Unknown fh.db action"));
    }
  });
};

var logCfg = {
  error: true,
  warn: false,
  warning: false,
  info: false,
  debug: false
};

var my_db_logger = {
  error: function (s) {doLog("error", "LOCALDB error", s);},
  warn: function (s) {doLog("warn", "LOCALDB warn", s);},
  warning: function (s) {doLog("warning", "LOCALDB warning", s);},
  info: function (s) {doLog("info", "LOCALDB info", s);},
  debug: function (s) {doLog("debug", "LOCALDB debug", s);}
};

var doLog = function(level, prefix, msg) {
  if( logCfg[level] ) {
    console.log(prefix, msg);
  }
}

exports.local_db = local_db;
exports.tearDownDitch = tearDownDitch;
exports.Ditcher = fhditcher.Ditcher;
exports.Database = fhdb.Database;
exports.parseMongoConnectionURL = parseMongoConnectionURL;

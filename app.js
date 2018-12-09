'use strict';

const path = require('path');
const sleep = require('mz-modules/sleep');
const Sequelize = require('sequelize');
const deprecate = require('depd')('pinus-sequelize');
const Loader = require('./lib/loader');
const Timing = require('./lib/timing');
const {getLogger} =  require('pinus-logger');
const timing = new Timing();
const AUTH_RETRIES = Symbol('authenticateRetries');

const logger = getLogger('pinus-sequelize', path.basename(__filename));

const defaultConfig = {
  delegate: 'model',
  baseDir: 'model',
  logging: function(...args) {
    // if benchmark enabled, log used,
    const used = typeof args[1] === 'number' ? `(${args[1]} ms)` : '';
    const sql = args[0].indexOf('Executed') === 0 && args[0].slice(20) || args[0]
    this.logger.debug('%s %s', sql, used);
  },
  host: 'localhost',
  port: 3306,
  username: 'root',
  benchmark: true,
  define: {
    freezeTableName: false,
    underscored: true,
  },
};

exports.configure = (app) => {
  
  let config = loadConfig(path.join(app.getBase(), 'config'), 'sequelize')
  if (!config.sequelize){
    logger.error(`can not find sequelize config in config directory ` + app.getBase(), 'config');
    return
  }
  else {
    config = config.sequelize[app.env]
  }

  const databases = [];
  if (!config.datasources) {
    databases.push(loadDatabase(Object.assign({}, defaultConfig, config)));
  } else {
    config.datasources.forEach(datasource => {
      databases.push(loadDatabase(Object.assign({}, defaultConfig, datasource)));
    });
  }

  setTimeout(async () => {
    await Promise.all(databases.map(database => authenticate(database)));
  }, 0);

  function loadConfig(directory, filename) {
    let conf = {}
    let opt = {
      directory,
      match: [ `${filename}.(js|ts|json)`],
      target: conf,
    };
  
    const timingKey = `Load Sequelize Config`;
    timing.start(timingKey);
    new Loader(opt).load();
    timing.end(timingKey);

    return conf
  }
  
  function loadToApp(directory, property, opt) {
    opt = Object.assign({}, {
      directory,
      target: app[property],
      inject: app,
    }, opt);

    const timingKey = `Load "${String(property)}" to Application`;
    timing.start(timingKey);
    new Loader(opt).load();
    timing.end(timingKey);
  }

  /**
   * load databse to app[config.delegate]
   * @param {Object} config config for load
   *   - delegate: load model to app[delegate]
   *   - baeDir: where model located
   *   - other sequelize configures(databasem username, password, etc...)
   * @return {Object} sequelize instance
   */
  function loadDatabase(config = {}) {
    if (typeof config.ignore === 'string' || Array.isArray(config.ignore)) {
      deprecate(`if you want to exclude ${config.ignore} when load models, please set to config.sequelize.exclude instead of config.sequelize.ignore`);
      config.exclude = config.ignore;
      delete config.ignore;
    }

    config.logger = getLogger('pinus-sequelize', config.delegate);
    config.logging = config.logging.bind(config)

    const sequelize = new Sequelize(config.database, config.username, config.password, config);

    app.set(config.delegate, sequelize, true)

    const modelDir = path.join(app.getBase(), 'app', config.baseDir);

    const models = [];
    loadToApp(modelDir, config.delegate, {
      caseStyle: 'upper',
      ignore: config.exclude,
      filter(model) {
        if (!model || !model.sequelize) return false;
        models.push(model);
        return true;
      },
      initializer(factory) {
        if (typeof factory === 'function') {
          return factory(app, sequelize);
        }
      },
    });

    models.forEach(model => {
      typeof model.associate === 'function' && model.associate();
    });

    return app[config.delegate];
  }

  /**
   * Authenticate to test Database connection.
   *
   * This method will retry 3 times when database connect fail in temporary, to avoid Egg start failed.
   * @param {Application} database instance of sequelize
   */
  async function authenticate(database) {
    database[AUTH_RETRIES] = database[AUTH_RETRIES] || 0;

    try {
      await database.authenticate();
    } catch (e) {
      if (e.name !== 'SequelizeConnectionRefusedError') throw e;
      if (app.model[AUTH_RETRIES] >= 3) throw e;

      // sleep 2s to retry, max 3 times
      database[AUTH_RETRIES] += 1;
      logger.warn(`Sequelize Error: ${e.message}, sleep 2 seconds to retry...`);
      await sleep(2000);
      await authenticate(app, database);
    }
  }
};

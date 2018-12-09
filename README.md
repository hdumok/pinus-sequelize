# pinus-sequelize

[Sequelize](http://sequelizejs.com) plugin for [Pinus](https://github.com/node-pinus/pinus).

> NOTE: 这个插件只是为了集成Sequelize到Pinus, 更多的文档请访问 http://sequelizejs.com, 本插件的代码基本参考了 [egg-sequelize](https://github.com/eggjs/egg-sequelize) 引入 egg 的方式。

[![NPM version][npm-image]][npm-url]
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/pinus-sequelize.svg?style=flat-square
[npm-url]: https://npmjs.org/package/pinus-sequelize
[download-image]: https://img.shields.io/npm/dm/pinus-sequelize.svg?style=flat-square
[download-url]: https://npmjs.org/package/pinus-sequelize

## Install

```bash
$ npm i --save pinus-sequelize
$ npm install --save mysql2 # For both mysql and mariadb dialects

# Or use other database backend.
$ npm install --save pg pg-hstore # PostgreSQL
$ npm install --save tedious # MSSQL
```
## Node 
* 配置也默认遵守sequelize风格, 最终的dist/app/config/sequelize.(js|json)里有
```
{
  development: {...},
  production: {...}
}
```
* 默认 delegate 为 "model", 读取app/model目录, 即挂载sequlize实例到app.model上, 可以通过app.model或 app.get('model'）获得。
## Usage & configuration
```
// app.ts
import * as sequelize from 'pinus-sequelize';
sequelize.configure(app);
```
```
// 默认配置
{
  delegate: 'model',
  baseDir: 'model', //app目录下
  logging: function(...args) {
    const used = typeof args[1] === 'number' ? `(${args[1]} ms)` : '';
    const sql = args[0].indexOf('Executed') === 0 && args[0].slice(20) || args[0]
    //此处 this 是最终的配置对象
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
}
```
```
// 多种数据配置, 通过 app.get(delegate)获得该数据库对象
{
  datasources: [{
    delegate: 'model',
    baseDir: 'model',
    ....
  }, {
    delegate: 'model2',
    baseDir: 'model2',
    ....
  }]
}
```

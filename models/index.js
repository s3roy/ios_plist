const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize("plist_db2", "root", "root", {
  host: "localhost",
  dialect: "mysql",
  dialectOptions: {
    authPlugins: {
      mysql_native_password: () =>
        require("mysql2/lib/auth_plugins").caching_sha2_password,
    },
  },
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.KeyHash = require("./keyHash")(sequelize, DataTypes);

module.exports = db;

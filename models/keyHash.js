module.exports = (sequelize, DataTypes) => {
    const KeyHash = sequelize.define('KeyHash', {
        appName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        hash: {
            type: DataTypes.STRING,  // Changed to STRING to store Base64 encoded hash
            allowNull: false,
        },
    });
    return KeyHash;
};

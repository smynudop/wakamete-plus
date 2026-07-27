const database = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE);

if (!database.getUser(process.env.MONGO_APP_USERNAME)) {
  database.createUser({
    user: process.env.MONGO_APP_USERNAME,
    pwd: process.env.MONGO_APP_PASSWORD,
    roles: [{ role: "readWrite", db: process.env.MONGO_INITDB_DATABASE }],
  });
}

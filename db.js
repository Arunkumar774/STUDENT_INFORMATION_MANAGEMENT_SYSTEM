var mysql=require('mysql');
const dotenv=require("dotenv");
dotenv.config();
const DB_HOST = process.env.DB_HOST;
const DB_USER =process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_DATABASE =process.env.DB_DATABASE;
const DB_PORT = process.env.DB_PORT;
const port = process.env.PORT;
const connection = mysql.createConnection({
    connectionLimit:100,
    host:DB_HOST,
    user:DB_USER,
    password:DB_PASSWORD,
    database:DB_DATABASE,
    port:DB_PORT
},{ multipleStatements: true });
connection.connect(function(error){
   if(!!error){
     console.log(error);
   }else{
     console.log('database Connected!:)');
   }
 });  
module.exports = connection; 

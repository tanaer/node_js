//config file for bae
if(typeof process != 'undefined' && process.BAE){
    sumeru.config.database({
        dbname : 'your_bae_db_name'
    });
    sumeru.config({
        site_url : 'http://yourapp.duapp.com/', //with tailing slash
    });
}
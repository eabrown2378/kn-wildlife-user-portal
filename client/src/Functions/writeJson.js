import {writeFile} from 'fs';



const writeJson = (json, filename) => {

    const string_json = JSON.stringify(json);

    writeFile(filename, string_json, "utf8");


}


export {writeJson};
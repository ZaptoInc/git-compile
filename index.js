import fetch from 'node-fetch'
import cfg  from './config.json' assert { type: 'json' };
import fs from 'fs'
import {mkdir} from 'fs/promises'
import {writeFile} from 'fs'
import {promisify} from 'util'
const writeFilePromise = promisify(writeFile);
import path from 'path'
import extract from 'extract-zip'
import {exec} from 'child_process'

console.log(cfg)

setInterval(CheckAndDownload, 60000)

async function CheckAndDownload() {
    var commit_master = await fetch(`https://api.github.com/repos/${cfg.Author}/${cfg.Repo}/commits/${cfg.Branch}`, {
        headers: {       
            "Authorization": `token ${cfg.GithubToken}`,
        },
        method: "GET"
    })
    var commit_master_data = await commit_master.json()
    if (commit_master_data.sha !== cfg.LatestCommit) {
        cfg.LatestCommit = commit_master_data.sha
        fs.writeFile('config.json', JSON.stringify(cfg, null, 4), async function(err){
            if (err) throw err;
            const temp_dest = path.resolve("./", "temp")
            if (fs.existsSync(temp_dest)) {
                fs.rmSync(temp_dest, { recursive: true, force: true })
            }
            console.log(`Downloading commit ${commit_master_data.sha}`)            
            if (!fs.existsSync(temp_dest)) await mkdir(temp_dest); //Optional if you already have downloads directory
            const destination = path.resolve(temp_dest, "master.zip");
            fetch(`https://api.github.com/repos/${cfg.Author}/${cfg.Repo}/zipball/${cfg.Branch}`, {
                headers: {       
                    "Authorization": `token ${cfg.GithubToken}`,
                },
                method: "GET"
            }).then(x => x.arrayBuffer())
            .then(x => writeFilePromise(destination, Buffer.from(x))
            .then(async function(){
                console.log(`Extracting commit ${commit_master_data.sha}`)
                await extract(destination, { dir: temp_dest })
                var temp_folders = fs.readdirSync(temp_dest)
                const dest = path.resolve("./", cfg.Folder)
                if (!fs.existsSync(dest)) await mkdir(dest);
                temp_folders.forEach(function(e){
                    var last_part = e.replace('\\', '/').split('/').slice(-1)[0]
                    if(!last_part.endsWith('.zip')){
                        fs.cpSync(path.resolve(temp_dest, last_part), dest, { recursive: true })
                    }
                    exec(cfg.Script, {cwd : dest}, (error, stdout, stderr) => {
                        if (error) {
                            console.log(`error: ${error.message}`);
                            return;
                        }
                        if (stderr) {
                            console.log(`Script error: ${stderr}`);
                            return;
                        }
                        console.log(`Script output: ${stdout}`);
                    })           
                })

            }))           
            
        })

       
    }
}

CheckAndDownload()
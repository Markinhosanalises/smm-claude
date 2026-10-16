const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
for(const dir of ['api','lib','scripts','test','public']) {
  if(!fs.existsSync(dir))continue;
  for(const name of fs.readdirSync(dir)) if(name.endsWith('.js')) new vm.Script(fs.readFileSync(path.join(dir,name),'utf8'),{filename:path.join(dir,name)});
}
for(const file of fs.readdirSync('public').filter(f=>f.endsWith('.html'))) {
  const html=fs.readFileSync('public/'+file,'utf8');
  for(const match of html.matchAll(/<script\b[^>]*src="\/([^\"]+)"/gi)) if(!fs.existsSync('public/'+match[1]))throw new Error('Script ausente: '+match[1]);
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(m[1],{filename:file});
}
console.log('JavaScript e scripts HTML: sintaxe válida');

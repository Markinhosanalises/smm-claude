const assert=require('node:assert/strict');
const forms=require('../public/service-forms'),catalog=require('../public/catalog-text');
module.exports=async function checkAllServiceForms(){
 const expiry=new Date(Date.now()+30*86400000).toISOString().slice(0,10),sample={ativo:true,min:1,max:10000,nomeOriginal:'Instagram 5 Comments (Custom)',redeSocial:'instagram'};
 const bodies={
 Default:{quantidade:100},Package:{},SEO:{quantidade:100,keywords:'tema'},
 'Custom Comments':{comments:'um\ndois\ntrês'},'Mentions Custom List':{usernames:'u1\nu2'},
 'Mentions Hashtag':{quantidade:100,hashtag:'tema'},'Mentions User Followers':{quantidade:100,username:'https://instagram.com/origem'},
 'Custom Comments Package':{comments:'um\ndois\ntrês\nquatro\ncinco'},'Comment Likes':{quantidade:100,username:'autor'},
 Poll:{quantidade:100,answer_number:1},'Comment Replies':{username:'autor',comments:'um\ndois'},
 'Invites from Groups':{quantidade:100,groups:'grupo1\ngrupo2'},
 Subscriptions:{quantidade:100,username:'usuario',posts:2,old_posts:0,delay:0,expiry}
 };
 for(const type of forms.types){
  const service={...sample,tipo:type},input=forms.normalize(service,{link:'https://instagram.com/p/teste',...bodies[type]});
  assert(input.quantity>0,type);assert(input.billableQuantity>0,type);assert(forms.amount(service,10,input).cents>0,type);
  assert.equal(forms.describe(service).supported,true,type);
  if(type==='Package'||type==='Custom Comments Package')assert.equal(forms.amount(service,10,input).cents,1000);
  if(type==='Subscriptions'){assert(!('link'in input.params));assert.equal(input.params.posts,2);assert.equal(input.billableQuantity,200);}
 }
 assert.throws(()=>forms.normalize({...sample,tipo:'Poll'},{link:'https://example.com',quantidade:100,answer_number:0}),/alternativa/);
 assert.throws(()=>forms.normalize({...sample,tipo:'Subscriptions'},{...bodies.Subscriptions,posts:101}),/publicações/);
 assert.throws(()=>forms.normalize({...sample,tipo:'Custom Comments Package'},{link:'https://example.com',comments:'apenas um'}),/5 comentários/);
 const subscription={...sample,tipo:'Subscriptions'};
 assert.throws(()=>forms.normalize(subscription,{...bodies.Subscriptions,expiry:'2000-01-01'}),/data final/);
 assert.throws(()=>forms.normalize({...sample,tipo:'Default'},{link:'javascript:alert(1)',quantidade:100}),/Link/);
 assert.equal(forms.amount({...sample,tipo:'Default'},0.001,{billableQuantity:1,quantity:1,package:false}).cents,1);
 assert.equal(catalog.network('IGTV Likes','comentário'),'instagram');
 assert.equal(catalog.network('Other','Instagram Medium Quality Followers'),'instagram');
 assert.equal(catalog.network('Apple Music','Plays'),'apple music');
 const text=catalog.translate('Mea Own Measmm.com Meafol Measeg Instagram Followers NoRefill 30 Days');
 assert(!/measmm|meafol|measeg|\bmea\b/i.test(text));assert(/Fênix Social/.test(text));assert(/seguidores/.test(text));assert(/sem reposição/.test(text));assert(/30 dias/.test(text));
 assert(catalog.score({refill:true,cancel:true})>catalog.score({refill:true,cancel:false}));
 assert.equal(forms.target({tipo:'Default',redeSocial:'facebook',nome:'Facebook página curtidas + seguidores'}).kind,'profile');
 assert.equal(catalog.translate(catalog.translate('Cancel Button Natural Increase')),catalog.translate('Cancel Button Natural Increase'));
 const current=catalog.present({nomeOriginal:'Twitter Followers',nomeCustomizado:'~~~~~~~~~',taxaCusto:1});assert.equal(current.nome,'Twitter seguidores');
 return {modalities:forms.types.length,passed:true};
};
if(require.main===module)require('node:test')('all service forms, billing and branding contracts',module.exports);

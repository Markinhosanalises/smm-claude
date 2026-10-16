document.querySelectorAll('.faq-q').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const a=btn.nextElementSibling,open=btn.classList.contains('open');
      document.querySelectorAll('.faq-q').forEach(b=>{b.classList.remove('open');b.nextElementSibling.classList.remove('open');});
      if(!open){btn.classList.add('open');a.classList.add('open');}
    });
  });
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      const t=document.querySelector(a.getAttribute('href'));
      if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'});}
    });
  });

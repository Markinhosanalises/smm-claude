function copiar(btn){
    const pre = btn.parentElement;
    const texto = pre.innerText.replace('Copiar','').trim();
    navigator.clipboard.writeText(texto).then(()=>{
      btn.textContent = 'Copiado ✓';
      setTimeout(()=>btn.textContent='Copiar', 2000);
    });
  }

  // highlight ativo na sidebar
  const links = document.querySelectorAll('.sidebar a');
  window.addEventListener('scroll', ()=>{
    const pos = window.scrollY + 100;
    links.forEach(a=>{
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if(el && el.offsetTop <= pos && el.offsetTop + el.offsetHeight > pos){
        links.forEach(l=>l.classList.remove('ativa'));
        a.classList.add('ativa');
      }
    });
  });

document.addEventListener('click',e=>{const btn=e.target.closest('[data-copy-pre]');if(btn)copiar(btn);});

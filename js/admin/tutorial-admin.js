sesion.requerir(["admin"]);
const form=document.getElementById("form-tutorial-admin");
const lista=document.getElementById("tutorial-admin-lista");
const tipo=document.getElementById("tutorial-tipo");
const archivo=document.getElementById("tutorial-archivo");
const url=document.getElementById("tutorial-url");
const archivoCampo=document.getElementById("tutorial-archivo-campo");
const urlCampo=document.getElementById("tutorial-url-campo");
const nombreArchivo=document.getElementById("tutorial-archivo-nombre");

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function actualizarCampos(){
  const externo=tipo.value==="enlace";
  archivoCampo.style.display=externo?"none":"flex";
  urlCampo.style.display=externo?"flex":"flex";
  url.placeholder=externo?"https://ejemplo.com/tutorial":(tipo.value==="video"?"Opcional: ../assets/tutorial.mp4":"Opcional: ../assets/documento.pdf");
  archivo.accept=tipo.value==="video"?"video/*":".pdf,application/pdf";
}
tipo.addEventListener("change",actualizarCampos);
archivo.addEventListener("change",()=>{nombreArchivo.textContent=archivo.files[0]?`✓ ${archivo.files[0].name}`:"Ningún archivo seleccionado";});

function pintar(){
 const a=JSON.parse(localStorage.getItem("cicsa_tutoriales")||"[]");
 lista.innerHTML=a.length?a.map((t,i)=>`<article class="tutorial-admin-card"><div class="tutorial-admin-icono">${t.tipo==="video"?"🎬":t.tipo==="pdf"?"📄":"🔗"}</div><div class="tutorial-admin-info"><strong>${esc(t.titulo)}</strong><span>${esc(t.tipo.toUpperCase())}</span><p>${esc(t.descripcion||"Sin descripción")}</p><small>${esc(t.nombreArchivo||t.url||"Archivo guardado")}</small></div><button class="btn btn-texto peligro" data-borrar="${i}">Eliminar</button></article>`).join(""):"<div class='tutorial-vacio'>📚<strong>No hay materiales publicados</strong><span>Cuando publiques un tutorial, aparecerá aquí.</span></div>";
 lista.querySelectorAll("[data-borrar]").forEach(b=>b.onclick=()=>{if(confirm("¿Eliminar este tutorial?")){a.splice(Number(b.dataset.borrar),1);localStorage.setItem("cicsa_tutoriales",JSON.stringify(a));pintar();}});
}
form?.addEventListener("submit",e=>{
 e.preventDefault();
 const file=archivo.files[0], selectedUrl=url.value.trim();
 if(!file&&!selectedUrl){alert("Selecciona un archivo o escribe una URL.");return;}
 if(file&&tipo.value==="video"&&file.size>3500000){alert("El video supera 3.5 MB. Usa una URL o coloca el video en la carpeta assets.");return;}
 const guardar=(src,nombre)=>{const a=JSON.parse(localStorage.getItem("cicsa_tutoriales")||"[]");a.push({titulo:document.getElementById("tutorial-titulo").value,tipo:tipo.value,url:src,nombreArchivo:nombre||"",descripcion:document.getElementById("tutorial-descripcion").value});try{localStorage.setItem("cicsa_tutoriales",JSON.stringify(a));form.reset();nombreArchivo.textContent="Ningún archivo seleccionado";actualizarCampos();pintar();}catch(err){alert("No se pudo guardar. El archivo es demasiado grande para el almacenamiento del navegador.");}};
 if(file){const reader=new FileReader();reader.onload=()=>guardar(reader.result,file.name);reader.readAsDataURL(file);}else guardar(selectedUrl,"");
});
actualizarCampos();pintar();
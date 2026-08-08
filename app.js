// ==========================================
// 1. CONFIGURACIÓN Y AUTENTICACIÓN SUPABASE
// ==========================================
const SUPABASE_URL = 'https://skznsamhdyslfmkgqdxz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrem5zYW1oZHlzbGZta2dxZHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMjgwODUsImV4cCI6MjEwMTcwNDA4NX0.7_e20KNDLOIBWMtfpUMXIZMoPAAoVSwuCYUaOyZdUCQ';

let supabaseClient = null;

try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) {
  console.error("Error al inicializar Supabase:", e);
}

document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('loginForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      await iniciarSesion(email, password);
    });
  }

  await verificarEstadoAcceso();
});

async function verificarEstadoAcceso() {
  if (!supabaseClient) return;

  const loginContainer = document.getElementById('loginContainer');
  const appContent = document.getElementById('appContent');

  try {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

    if (!session || sessionError) {
      if (loginContainer) loginContainer.style.display = 'flex';
      if (appContent) appContent.style.display = 'none';
      return;
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      await supabaseClient.auth.signOut();
      if (loginContainer) loginContainer.style.display = 'flex';
      if (appContent) appContent.style.display = 'none';
      return;
    }

    if (user.banned_until) {
      mostrarPantallaBloqueo("Tu suscripción ha vencido o tu acceso ha sido suspendido.");
      return;
    }

    if (loginContainer) loginContainer.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
  } catch (err) {
    console.error("Error en verificación:", err);
  }
}

async function iniciarSesion(email, password) {
  const errorBox = document.getElementById('authError');
  if (errorBox) errorBox.style.display = 'none';

  if (!supabaseClient) {
    alert("El módulo de autenticación no cargó correctamente.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    if (errorBox) {
      errorBox.textContent = "Error al ingresar: " + error.message;
      errorBox.style.display = 'block';
    } else {
      alert("Error al ingresar: " + error.message);
    }
  } else {
    await verificarEstadoAcceso();
  }
}

async function cerrarSesion() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  window.location.reload();
}

function mostrarPantallaBloqueo(mensaje) {
  const loginContainer = document.getElementById('loginContainer');
  const appContent = document.getElementById('appContent');
  
  if (appContent) appContent.style.display = 'none';
  if (loginContainer) {
    loginContainer.style.display = 'flex';
    document.getElementById('authTitle').textContent = "Acceso Suspendido";
    document.getElementById('authSubtitle').textContent = mensaje;
    const form = document.getElementById('loginForm');
    if (form) form.style.display = 'none';
  }
}

// ==========================================
// 2. CÓDIGO CORE DE LA APLICACIÓN
// ==========================================
const KEY = 'prestamo-claro-v1';
const money = n => new Intl.NumberFormat('es-VE',{style:'currency',currency:'USD'}).format(Number(n)||0);
const dateFmt = d => new Intl.DateTimeFormat('es-VE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00'));
const iso = d => new Date(d).toISOString().slice(0,10);
const today = iso(new Date());
const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random());
let view='dashboard', selectedLoan=null, selectedCalendarDate=today, calendarMonth=new Date(today+'T12:00:00');
let data = JSON.parse(localStorage.getItem(KEY) || '{"clients":[],"loans":[],"payments":[]}');
function save(){localStorage.setItem(KEY,JSON.stringify(data));}
function client(id){return data.clients.find(x=>x.id===id);}
function paid(loan){return data.payments.filter(p=>p.loanId===loan.id).reduce((s,p)=>s+Number(p.amount),0)}
function balance(loan){return Math.max(0,Number(loan.total)-paid(loan))}
function status(loan){if(!balance(loan))return ['Pagado','']; if(loan.nextPayment<today)return ['Vencido','overdue']; return ['Pendiente','pending'];}
function loansOpen(){return data.loans.filter(l=>balance(l)>0)}
function nextCollectionDate(loan){
  let current=new Date(loan.nextPayment+'T12:00:00'), next;
  if(loan.frequency==='weekly') next=new Date(current.setDate(current.getDate()+7));
  else if(loan.frequency==='biweekly') next=new Date(current.setDate(current.getDate()+14));
  else if(loan.frequency==='monthly') {
    next=new Date(current.getFullYear(),current.getMonth()+1,1,12);
    let wanted=Number(loan.paymentDay)||new Date(loan.nextPayment+'T12:00:00').getDate();
    next.setDate(Math.min(wanted,new Date(next.getFullYear(),next.getMonth()+1,0).getDate()));
  } else next=new Date(current.setDate(current.getDate()+(Number(loan.customDays)||30)));
  return iso(next);
}
function frequencyLabel(loan){return ({weekly:'Semanal',biweekly:'Quincenal',monthly:`Mensual · día ${loan.paymentDay||''}`,custom:`Cada ${loan.customDays||30} días`})[loan.frequency||'custom']}
function dueToday(){return loansOpen().filter(l=>l.nextPayment<=today)}
function sendDueNotifications(){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const notified=JSON.parse(localStorage.getItem('prestamo-notified')||'{}');
  dueToday().forEach(l=>{
    const marker=`${today}:${l.id}`;
    if(notified[marker])return;
    const c=client(l.clientId)||{};
    new Notification('Cobro pendiente', {body:`${c.name||'Cliente'} · ${money(balance(l))} · ${l.nextPayment<today?'vencido':'vence hoy'}`});
    notified[marker]=true;
  });
  localStorage.setItem('prestamo-notified',JSON.stringify(notified));
}
function paymentRows(loans){return loans.map(l=>{let c=client(l.clientId)||{};let s=status(l);return `<tr><td><div class="name">${esc(c.name||'Cliente eliminado')}</div><div class="sub">${esc(c.phone||'')}</div></td><td>${esc(l.number)}</td><td>${dateFmt(l.nextPayment)}</td><td><b>${money(balance(l))}</b></td><td><span class="badge ${s[1]}">${s[0]}</span></td><td><button class="link-button" data-action="loan-detail" data-id="${l.id}">Ver</button></td></tr>`}).join('')}
function esc(s=''){const e=document.createElement('div');e.textContent=s;return e.innerHTML}
function empty(text){return `<div class="empty">${text}</div>`}
function render(){
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent=({dashboard:'Resumen',clients:'Clientes',loans:'Préstamos y facturas',receivables:'Cuentas por cobrar',calendar:'Agenda de pagos',history:'Historial',backup:'Copias de seguridad'})[view];
  document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); 
  const pages={dashboard,clients,loans,receivables,calendar,history,backup};
  const viewEl = document.getElementById('view');
  if (viewEl) viewEl.innerHTML=pages[view]();
}
function dashboard(){let open=loansOpen(), overdue=open.filter(x=>x.nextPayment<today), total=data.loans.reduce((s,l)=>s+Number(l.total),0), outstanding=open.reduce((s,l)=>s+balance(l),0), due=dueToday();let upcoming=[...open].sort((a,b)=>a.nextPayment.localeCompare(b.nextPayment)).slice(0,5);return `<div class="cards"><article class="card"><label>Capital prestado</label><div class="amount">${money(total)}</div><small>En ${data.loans.length} préstamo(s)</small></article><article class="card"><label>Por cobrar</label><div class="amount warning">${money(outstanding)}</div><small>${open.length} cuenta(s) activa(s)</small></article><article class="card"><label>Cobrado</label><div class="amount positive">${money(total-outstanding)}</div><small>Pagos registrados</small></article><article class="card"><label>Pagos vencidos</label><div class="amount ${overdue.length?'warning':'positive'}">${overdue.length}</div><small>Requieren seguimiento</small></article></div>${due.length?`<section class="panel"><div class="panel-title"><h2>🔔 Cobros para hoy</h2><button class="secondary" data-action="enable-notifications">Activar notificaciones</button></div>${due.map(l=>{let c=client(l.clientId)||{};return `<div class="agenda-item"><div class="datebox"><strong>${new Date(l.nextPayment+'T12:00:00').getDate()}</strong>hoy</div><div><div class="name">${esc(c.name)}</div><div class="sub">${esc(l.number)} · ${money(balance(l))} · ${frequencyLabel(l)}</div></div><button class="link-button" data-action="loan-detail" data-id="${l.id}">Cobrar</button></div>`}).join('')}</section>`:''}<div class="split"><section class="panel"><div class="panel-title"><h2>Próximos pagos</h2><button class="link-button" data-view-link="calendar">Ver agenda</button></div>${upcoming.length?upcoming.map(l=>{let c=client(l.clientId)||{};return `<div class="agenda-item"><div class="datebox"><strong>${new Date(l.nextPayment+'T12:00:00').getDate()}</strong>${new Intl.DateTimeFormat('es-VE',{month:'short'}).format(new Date(l.nextPayment+'T12:00:00'))}</div><div><div class="name">${esc(c.name)}</div><div class="sub">${money(balance(l))} · ${esc(l.number)} · ${frequencyLabel(l)}</div></div><button class="link-button" data-action="loan-detail" data-id="${l.id}">Cobrar</button></div>`}).join(''):empty('Aún no hay pagos pendientes.')}</section><section class="panel"><div class="panel-title"><h2>Acciones rápidas</h2></div><p class="sub">Registra tu actividad en pocos pasos.</p><div class="backup-actions"><button class="primary" data-action="new-client">Nuevo cliente</button><button class="secondary" data-action="new-loan">Crear préstamo</button></div></section></div>`}
function clients(){return `<section class="panel"><div class="panel-title"><h2>Clientes</h2><button class="primary" data-action="new-client">+ Añadir cliente</button></div><div class="filters"><input class="search" id="clientSearch" placeholder="Buscar por nombre, cédula o teléfono" /></div>${data.clients.length?`<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Contacto</th><th>Préstamos activos</th><th>Saldo total</th><th></th></tr></thead><tbody>${data.clients.map(c=>{let ls=loansOpen().filter(l=>l.clientId===c.id);return `<tr><td><div class="name">${esc(c.name)}</div><div class="sub">${esc(c.document||'Sin documento')}</div></td><td>${esc(c.phone||'—')}</td><td>${ls.length}</td><td><b>${money(ls.reduce((s,l)=>s+balance(l),0))}</b></td><td><button class="link-button" data-action="client-detail" data-id="${c.id}">Ver</button></td></tr>`}).join('')}</tbody></table></div>`:empty('Crea tu primer cliente para empezar.')}</section>`}
function loans(){return `<section class="panel"><div class="panel-title"><h2>Préstamos / facturas</h2><button class="primary" data-action="new-loan">+ Nuevo préstamo</button></div>${data.loans.length?`<div class="table-wrap"><table><thead><tr><th>Factura</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Saldo</th><th>Estado</th><th></th></tr></thead><tbody>${data.loans.map(l=>{let c=client(l.clientId)||{},s=status(l);return `<tr><td class="name">${esc(l.number)}</td><td>${esc(c.name||'—')}</td><td>${dateFmt(l.date)}</td><td>${money(l.total)}</td><td><b>${money(balance(l))}</b></td><td><span class="badge ${s[1]}">${s[0]}</span></td><td><button class="link-button" data-action="loan-detail" data-id="${l.id}">Abrir</button></td></tr>`}).join('')}</tbody></table></div>`:empty('No hay préstamos registrados.')}</section>`}
function receivables(){let open=[...loansOpen()].sort((a,b)=>a.nextPayment.localeCompare(b.nextPayment));return `<section class="panel"><div class="panel-title"><h2>Cuentas pendientes</h2><span class="sub">${open.length} pendiente(s)</span></div>${open.length?`<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Factura</th><th>Próximo pago</th><th>Saldo</th><th>Estado</th><th></th></tr></thead><tbody>${paymentRows(open)}</tbody></table></div>`:empty('¡Todo está al día!')}</section>`}
function calendar(){let d=calendarMonth, year=d.getFullYear(), month=d.getMonth(), first=new Date(year,month,1), last=new Date(year,month+1,0), offset=(first.getDay()+6)%7;let cells=[];for(let i=0;i<offset;i++)cells.push('<div class="day muted"></div>');for(let n=1;n<=last.getDate();n++){let day=iso(new Date(year,month,n)),events=loansOpen().filter(l=>l.nextPayment===day);cells.push(`<button class="day ${day===today?'today':''} ${day===selectedCalendarDate?'selected':''}" data-action="select-day" data-date="${day}"><div class="day-num">${n}</div>${events.map(l=>`<div class="event ${day<today?'overdue':''}" title="${esc((client(l.clientId)||{}).name)}">${esc((client(l.clientId)||{}).name)} · ${money(balance(l))}</div>`).join('')}</button>`)}let selected=loansOpen().filter(l=>l.nextPayment===selectedCalendarDate);return `<section class="panel"><div class="panel-title"><button class="secondary" data-action="calendar-prev">←</button><h2>${new Intl.DateTimeFormat('es-VE',{month:'long',year:'numeric'}).format(d)}</h2><button class="secondary" data-action="calendar-next">→</button></div><p class="sub">Selecciona un día para ver los cobros programados.</p><div class="calendar">${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=>`<div class="dow">${x}</div>`).join('')}${cells.join('')}</div></section><section class="panel"><div class="panel-title"><h2>Cobros del ${dateFmt(selectedCalendarDate)}</h2><span class="sub">${selected.length} cobro(s)</span></div>${selected.length?`<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Factura</th><th>Saldo</th><th>Frecuencia</th><th></th></tr></thead><tbody>${selected.map(l=>{let c=client(l.clientId)||{};return `<tr><td><div class="name">${esc(c.name)}</div><div class="sub">${esc(c.phone||'')}</div></td><td>${esc(l.number)}</td><td><b>${money(balance(l))}</b></td><td>${frequencyLabel(l)}</td><td><button class="link-button" data-action="loan-detail" data-id="${l.id}">Cobrar</button></td></tr>`}).join('')}</tbody></table></div>`:empty('No tienes cobros programados para este día.')}</section>`}
function history(){let ps=[...data.payments].sort((a,b)=>b.date.localeCompare(a.date));return `<section class="panel"><div class="panel-title"><h2>Historial de pagos</h2><span class="sub">${ps.length} registro(s)</span></div>${ps.length?`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Factura</th><th>Método</th><th>Monto</th><th>Recibo</th></tr></thead><tbody>${ps.map(p=>{let l=data.loans.find(x=>x.id===p.loanId)||{},c=client(l.clientId)||{};return `<tr><td>${dateFmt(p.date)}</td><td>${esc(c.name||'—')}</td><td>${esc(l.number||'—')}</td><td>${esc(p.method)}</td><td><b class="positive">${money(p.amount)}</b></td><td><button class="link-button" data-action="receipt" data-id="${p.id}">Ver recibo</button></td></tr>`}).join('')}</tbody></table></div>`:empty('Los cobros registrados aparecerán aquí.')}</section>`}
function backup(){return `<section class="panel"><div class="panel-title"><h2>Protege tu información</h2></div><p>Descarga una copia de tus clientes, préstamos y pagos. Puedes restaurarla luego en este u otro dispositivo.</p><div class="backup-actions"><button class="primary" data-action="export">Descargar copia</button><button class="secondary" data-action="restore">Restaurar copia</button></div><p class="sub" style="margin-top:20px">Última actualización local: ${new Date().toLocaleString('es-VE')}</p></section><section class="panel"><div class="panel-title"><h2>Datos de ejemplo</h2></div><p class="sub">Si estás explorando la aplicación, puedes cargar registros de muestra. Esta acción añade datos, no borra los existentes.</p><button class="secondary" data-action="demo">Cargar ejemplo</button></section>`}
function modal(title,body){
  const m = document.getElementById('modalRoot');
  if (m) m.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>${title}</h2><button class="close" data-action="close">×</button></div>${body}</div></div>`;
}
function clientForm(){modal('Nuevo cliente',`<form id="clientForm"><div class="form-grid"><label>Nombre completo<input name="name" required autofocus /></label><label>Cédula / documento<input name="document" /></label><label>Teléfono<input name="phone" type="tel" /></label><label class="full">Dirección<input name="address" /></label></div><div class="modal-footer"><button class="secondary" type="button" data-action="close">Cancelar</button><button class="primary">Guardar cliente</button></div></form>`);document.getElementById('clientForm').onsubmit=e=>{e.preventDefault();let o=Object.fromEntries(new FormData(e.target));data.clients.push({id:uid(),...o});save();close();render();}}
function scheduleField(frequency='weekly') { const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']; if(frequency==='monthly')return `<label> Día del mes de cobro<select name="paymentDay">${Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1} de cada mes</option>`).join('')}</select></label>`; if(frequency==='custom')return `<label>Cada cuántos días<input name="customDays" type="number" min="1" value="30" required /></label>`; return `<label>Día habitual de cobro<select name="paymentDay">${days.map((d,i)=>`<option value="${i}">${d}</option>`).join('')}</select></label>`; }
function loanForm(){if(!data.clients.length){clientForm();return}modal('Nuevo préstamo / factura',`<form id="loanForm"><div class="form-grid"><label>Cliente<select name="clientId" required>${data.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label>N.º de factura<input name="number" value="FAC-${String(data.loans.length+1).padStart(4,'0')}" required /></label><label>Capital prestado<input name="principal" type="number" min="0" step="0.01" required /></label><label>Interés (%)<input name="interest" type="number" min="0" step="0.01" value="0" required /></label><label>Frecuencia de cobro<select id="frequency" name="frequency"><option value="weekly">Semanal</option><option value="biweekly">Quincenal (cada 14 días)</option><option value="monthly">Mensual</option><option value="custom">Personalizada</option></select></label><span id="scheduleField">${scheduleField()}</span><label>Primer cobro<input name="nextPayment" type="date" value="${today}" required /></label><label>Fecha del préstamo<input name="date" type="date" value="${today}" required /></label><label class="full">Notas<input name="notes" placeholder="Condiciones o referencias" /></label></div><p class="sub">Al registrar un pago, se calculará automáticamente el siguiente cobro según esta frecuencia.</p><div class="modal-footer"><button class="secondary" type="button" data-action="close">Cancelar</button><button class="primary">Crear préstamo</button></div></form>`);document.getElementById('frequency').onchange=e=>document.getElementById('scheduleField').innerHTML=scheduleField(e.target.value);document.getElementById('loanForm').onsubmit=e=>{e.preventDefault();let o=Object.fromEntries(new FormData(e.target));o.total=Number(o.principal)*(1+Number(o.interest)/100);o.id=uid();data.loans.push(o);save();close();view='loans';render();}}
function loanDetail(id){let l=data.loans.find(x=>x.id===id),c=client(l.clientId)||{},ps=data.payments.filter(p=>p.loanId===id),s=status(l);selectedLoan=id;modal(`Factura ${esc(l.number)}`,`<div class="detail-grid"><div><small>Cliente</small><b>${esc(c.name)}</b></div><div><small>Total</small><b>${money(l.total)}</b></div><div><small>Saldo</small><b>${money(balance(l))}</b></div><div><small>Próximo pago</small><b>${dateFmt(l.nextPayment)}</b></div><div><small>Plan de cobro</small><b>${frequencyLabel(l)}</b></div><div><small>Estado</small><span class="badge ${s[1]}">${s[0]}</span></div><div><small>Notas</small><b>${esc(l.notes||'—')}</b></div></div>${balance(l)?`<div class="payment-row"><div><b>Registrar cobro</b><div class="sub">El próximo cobro se programará automáticamente.</div></div><button class="primary" data-action="new-payment" data-id="${id}">Cobrar</button></div>`:''}<h3>Pagos</h3>${ps.length?ps.map(p=>`<div class="agenda-item"><div><div class="name">${money(p.amount)} · ${esc(p.method)}</div><div class="sub">${dateFmt(p.date)}</div></div><button class="link-button" data-action="receipt" data-id="${p.id}">Recibo</button></div>`).join(''):empty('Sin pagos registrados.')}`)}
function paymentForm(id){let l=data.loans.find(x=>x.id===id);modal('Registrar pago',`<form id="paymentForm"><div class="form-grid"><label>Monto recibido<input name="amount" type="number" min="0.01" max="${balance(l)}" step="0.01" value="${balance(l)}" required /></label><label>Fecha<input name="date" type="date" value="${today}" required /></label><label class="full">Método de pago<select name="method"><option>Efectivo</option><option>Transferencia</option><option>Pago móvil</option><option>Otro</option></select></label></div><p class="sub">Próximo cobro programado: ${dateFmt(nextCollectionDate(l))} (${frequencyLabel(l)}).</p><div class="modal-footer"><button class="secondary" type="button" data-action="close">Cancelar</button><button class="primary">Guardar y ver recibo</button></div></form>`);document.getElementById('paymentForm').onsubmit=e=>{e.preventDefault();let p={id:uid(),loanId:id,...Object.fromEntries(new FormData(e.target))};p.amount=Number(p.amount);data.payments.push(p); if(balance(l)>0)l.nextPayment=nextCollectionDate(l); save();receipt(p.id);}}
function receipt(id){let p=data.payments.find(x=>x.id===id),l=data.loans.find(x=>x.id===p.loanId)||{},c=client(l.clientId)||{};modal('Recibo de pago',`<div id="printReceipt" class="receipt"><h2>PRÉSTAMO CLARO</h2><p class="sub" style="text-align:center">RECIBO DE PAGO · ${esc(l.number)}</p><hr><div class="receipt-line"><span>Fecha</span><b>${dateFmt(p.date)}</b></div><div class="receipt-line"><span>Recibido de</span><b>${esc(c.name)}</b></div><div class="receipt-line"><span>Método</span><b>${esc(p.method)}</b></div><hr><div class="receipt-line"><span>Monto recibido</span><h2>${money(p.amount)}</h2></div><div class="receipt-line"><span>Saldo restante</span><b>${money(balance(l))}</b></div><hr><p class="sub" style="text-align:center">Gracias por su pago.</p></div><div class="modal-footer"><button class="secondary" data-action="share-receipt" data-id="${id}">Enviar</button><button class="primary" data-action="print">Descargar / imprimir</button></div>`)}
function close(){const m = document.getElementById('modalRoot'); if (m) m.innerHTML=''}
function exportData(){let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`respaldo-prestamos-${today}.json`;a.click();URL.revokeObjectURL(a.href)}
function demo(){if(data.clients.length||data.loans.length){if(!confirm('Añadir ejemplos a tus datos actuales?'))return}let c={id:uid(),name:'María González',document:'V-18.456.789',phone:'0412-555-0184',email:'',address:''};data.clients.push(c);data.loans.push({id:uid(),clientId:c.id,number:'FAC-0001',principal:300,interest:10,total:330,date:today,nextPayment:today,notes:'Pago semanal'});save();view='dashboard';render()}

document.addEventListener('click',e=>{
  let b=e.target.closest('[data-action],[data-view-link]');
  if(!b)return;
  if(b.dataset.viewLink){view=b.dataset.viewLink;render();return}
  let a=b.dataset.action;
  if(a==='close')close();
  if(a==='new-client')clientForm();
  if(a==='new-loan')loanForm();
  if(a==='loan-detail')loanDetail(b.dataset.id);
  if(a==='client-detail'){
    let c=data.clients.find(x=>x.id===b.dataset.id);
    let l=data.loans.find(x=>x.clientId===c.id);
    if(l)loanDetail(l.id);
    else modal(esc(c.name),`<p>${esc(c.phone||'Sin teléfono')}</p><p>${esc(c.address||'Sin dirección')}</p>`);
  }
  if(a==='new-payment')paymentForm(b.dataset.id);
  if(a==='receipt')receipt(b.dataset.id);
  if(a==='print')window.print();
  if(a==='export')exportData();
  if(a==='restore'){const r = document.getElementById('restoreInput'); if (r) r.click();}
  if(a==='demo')demo();
  if(a==='enable-notifications'&&'Notification' in window)Notification.requestPermission().then(sendDueNotifications);
  if(a==='share-receipt'){
    let p=data.payments.find(x=>x.id===b.dataset.id);
    let l=data.loans.find(x=>x.id===p.loanId);
    let c=client(l.clientId);
    let msg=`Hola ${c.name}, recibimos tu pago de ${money(p.amount)} para la factura ${l.number}. Saldo restante: ${money(balance(l))}. Gracias.`;
    window.open(`https://wa.me/${(c.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank');
  }
});

const navEl = document.getElementById('nav');
if (navEl) {
  navEl.addEventListener('click',e=>{let b=e.target.closest('[data-view]');if(b){view=b.dataset.view;const sb = document.querySelector('.sidebar'); if(sb) sb.classList.remove('open');render()}});
}

const menuBtn = document.getElementById('menuButton');
if (menuBtn) {
  menuBtn.onclick=()=>{ const sb = document.querySelector('.sidebar'); if(sb) sb.classList.toggle('open'); }
}

const restoreInp = document.getElementById('restoreInput');
if (restoreInp) {
  restoreInp.onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);if(!Array.isArray(x.clients)||!Array.isArray(x.loans)||!Array.isArray(x.payments))throw Error();if(confirm('Esto reemplazará todos los datos actuales. ¿Continuar?')){data=x;save();render();alert('Copia restaurada correctamente.')}}catch{alert('El archivo no parece una copia válida.')}};r.readAsText(f)};
}

const todayEl = document.getElementById('today');
if (todayEl) todayEl.textContent=new Intl.DateTimeFormat('es-VE',{weekday:'long',day:'numeric',month:'long'}).format(new Date());

render();
sendDueNotifications();
setInterval(sendDueNotifications,15*60*1000);

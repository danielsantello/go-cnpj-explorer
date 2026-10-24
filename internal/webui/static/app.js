const $=s=>document.querySelector(s);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=s=>s.replace(/^([A-Z0-9]{2})([A-Z0-9]{3})([A-Z0-9]{3})([A-Z0-9]{4})([A-Z0-9]{2})$/,'$1.$2.$3/$4-$5');
const normalizeCnpj=value=>value.toUpperCase().replace(/[^A-Z0-9]/g,'');
const copyIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5A1.5 1.5 0 0 1 5.5 0h9A1.5 1.5 0 0 1 16 1.5v9a1.5 1.5 0 0 1-1.5 1.5H13v-1h1.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5V3H4z"/><path d="M1.5 4A1.5 1.5 0 0 0 0 5.5v9A1.5 1.5 0 0 0 1.5 16h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 10.5 4zm0 1h9a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5"/></svg>';
const copyButton = id => `<button type="button" class="btn btn-sm btn-link border-0 text-decoration-none ms-2 align-middle px-1 py-0" data-copy="${id}" aria-label="Copiar CNPJ ${format(id)} sem pontuação" title="Copiar CNPJ sem pontuação">${copyIcon}</button>`;
async function copyCnpj(id) {
 let copied=false;
 try { await navigator.clipboard.writeText(id); copied=true; } catch {
  // Compatibilidade com contextos em que a API Clipboard não está disponível.
  const previous=document.activeElement;
  const input=document.createElement('textarea');
  input.value=id; input.readOnly=true; input.className='position-fixed top-0 start-0 opacity-0';
  (document.querySelector('#company-modal.show .modal-body') || document.body).appendChild(input);
  input.select();
  try { copied=document.execCommand('copy'); } catch {} finally { input.remove(); previous?.focus({preventScroll:true}); }
 }
 $('#copy-message').textContent=copied?'CNPJ copiado sem pontuação: '+id:'Não foi possível copiar automaticamente. Selecione o CNPJ e copie com Ctrl+C ou o menu do dispositivo.';
 bootstrap.Toast.getOrCreateInstance($('#copy-toast'),{delay:4500}).show();
}
document.addEventListener('click',e=>{
 const copy=e.target.closest('[data-copy]');
 if(copy)copyCnpj(copy.dataset.copy);
 const partner=e.target.closest('[data-partner-name]');
 if(partner)startPartnerSearch(partner.dataset.partnerName,partner.dataset.partnerDocument);
});
function partnerSearchButton(name,document){
 if(typeof name!=='string'||name.trim().length<3||typeof document!=='string'||!document.trim()) {
  return '<span class="small text-body-secondary">Nome ou documento não informado para consultar vínculos.</span>';
 }
 return `<button type="button" class="btn btn-sm btn-outline-primary mt-2" data-partner-name="${escapeHtml(name)}" data-partner-document="${escapeHtml(document)}">Ver empresas deste sócio</button>`;
}
function startPartnerSearch(name,document){
 if(typeof name!=='string'||name.trim().length<3||typeof document!=='string'||!document.trim())return;
 cancelDetails();
 bootstrap.Modal.getOrCreateInstance($('#company-modal')).hide();
 state.mode='partners';state.query=name;state.partnerDocument=document;
 $('#mode').value='partners';$('#query').value=name;
 updateMode();
 return loadSelectedPages();
}
const labels={name:'Razão social',trade:'Nome fantasia',partners:'Sócios',cnpj:'CNPJ'};
let state={mode:'all',query:'',partnerDocument:'',pageSize:5,pages:{name:1,trade:1,partners:1,cnpj:1}};
const searchKinds = ['name', 'trade', 'partners'];
const resultKinds = [...searchKinds, 'cnpj'];
const searchEndpoints = {name:'/api/companies', trade:'/api/establishments', partners:'/api/partners'};
function isRemoteMode(){return state.mode === 'all' || resultKinds.includes(state.mode);}
function selectedKinds(){return state.mode === 'all' ? searchKinds : resultKinds.filter(kind => kind === state.mode);}
function emptySearch(){return {items:[], pagination:null, searched:false, loading:false, error:''};}
let remoteResults = Object.fromEntries(resultKinds.map(kind => [kind, emptySearch()]));
const searchControllers = {};

function cancelCompanySearch(kind) {
 for (const key of kind ? [kind] : resultKinds) {
  searchControllers[key]?.abort();
  delete searchControllers[key];
  remoteResults[key].loading = false;
 }
}
function resetRemoteResults(){
 remoteResults = Object.fromEntries(resultKinds.map(kind => [kind, emptySearch()]));
}

function fromAPI(item) {
 if (!item || !/^[A-Z0-9]{14}$/.test(item.cnpj) || typeof item.corporate_name !== 'string') {
  throw new Error('A API retornou um resumo de empresa inválido.');
 }
 const names = {'01':'Nula','02':'Ativa','03':'Suspensa','04':'Inapta','08':'Baixada'};
 return {
  id:item.cnpj,
  name:item.corporate_name,
  trade:typeof item.trade_name === 'string' ? item.trade_name : '',
  partnerName:typeof item.name === 'string' ? item.name : '',
  partnerDocument:typeof item.document === 'string' ? item.document : '',
  city:item.municipality?.description || '',
  uf:item.state || '',
  status:names[item.registration_status?.code] || 'Não informada',
  source:'api'
 };
}

// Cada seção tem resultado, erro, paginação e requisição próprios.
async function loadCompanyPage(page = 1, kind = state.mode) {
 if (!selectedKinds().includes(kind) || !Number.isInteger(page) || page < 1) return;
 cancelCompanySearch(kind);
 const controller = new AbortController();
 searchControllers[kind] = controller;
 const result = remoteResults[kind];
 Object.assign(result, {loading:true, searched:true, error:'', items:[], pagination:null});
 state.pages[kind] = page;
 render();
 const query = new URLSearchParams({name:state.query, page:String(page), page_size:String(state.pageSize)});
 if(kind==='partners'&&state.partnerDocument)query.set('document',state.partnerDocument);
 try {
  if (kind === 'cnpj') {
   const details = await fetchCompanyDetails(state.query, controller.signal);
   if (searchControllers[kind] !== controller) return;
   result.items = [summaryFromDetails(details)];
   return;
  }
  const response = await fetch(searchEndpoints[kind] + '?' + query, {cache:'no-store', signal:controller.signal});
  let payload;
  try {payload = await response.json();}
  catch {throw new Error('O Explorer retornou uma resposta inválida.');}
  if (!response.ok) {
   const messages = {
    SEARCH_TOO_BROAD:'A busca encontrou resultados demais. Digite um nome mais específico.',
    API_ERROR:'Não foi possível consultar a API. Confira a conexão na página de configurações.'
   };
   throw new Error(messages[payload.error?.code] || payload.error?.message || 'Não foi possível realizar a busca.');
  }
  const p = payload.pagination;
  if (!Array.isArray(payload.items) || !p ||
      !Number.isInteger(p.page) || p.page < 1 ||
      !Number.isInteger(p.page_size) || p.page_size < 1 ||
      !Number.isInteger(p.total_items) || p.total_items < 0 ||
      !Number.isInteger(p.total_pages) || p.total_pages < 0) {
   throw new Error('A resposta da busca não contém uma paginação válida.');
  }
  const items = payload.items.map(fromAPI);
  if (searchControllers[kind] !== controller) return;
  result.items = items;
  result.pagination = p;
  state.pages[kind] = p.page;
 } catch (error) {
  if (controller.signal.aborted || searchControllers[kind] !== controller) return;
  result.error = error.message || 'Não foi possível comunicar com o Explorer.';
 } finally {
  if (searchControllers[kind] === controller) {
   delete searchControllers[kind];
   result.loading = false;
   render();
  }
 }
}

function loadSelectedPages(){
 cancelCompanySearch();
 resetRemoteResults();
 resetPages();
 return Promise.all(selectedKinds().map(kind => loadCompanyPage(1, kind)));
}

function renderRemoteCompanies() {
 const kinds = selectedKinds();
 const searched = kinds.some(kind => remoteResults[kind].searched);
 $('#summary').textContent = searched
  ? `Busca por “${state.query}” · ${state.mode === 'all' ? 'Resultados separados por tipo' : labels[state.mode]} · Dados reais`
  : state.mode === 'cnpj' ? 'Informe um CNPJ para consultar a API.' : 'Digite um nome para consultar os dados reais da API.';
 $('#status-legend').innerHTML = statusLegend();
 const filter = state.mode==='partners'&&state.partnerDocument
  ? `<div class="alert alert-info d-flex flex-wrap align-items-center justify-content-between gap-2"><span>Vínculos por nome e documento: <span class="fw-semibold">${escapeHtml(state.query)}</span> · ${escapeHtml(state.partnerDocument)}</span><button type="button" class="btn btn-sm btn-outline-primary" data-clear-partner-filter>Buscar somente pelo nome</button></div>` : '';
 $('#results').innerHTML = filter + kinds.map(renderRemoteSection).join('');
}

function renderRemoteSection(kind) {
 const result = remoteResults[kind];
 const label = labels[kind];
 const unit = kind === 'partners' ? 'vínculo' : kind === 'trade' ? 'estabelecimento' : 'empresa';
 let content;
 if (result.loading) {
  content = '<div class="card-body py-4" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Buscando...</div>';
 } else if (result.error) {
  content = `<div class="card-body"><div class="alert alert-danger mb-0" role="alert">${escapeHtml(result.error)}</div><button type="button" class="btn btn-sm btn-outline-primary mt-3" data-kind="${kind}" data-page="${state.pages[kind]}">Tentar novamente</button></div>`;
 } else if (!result.searched) {
  content = `<div class="card-body py-4 text-body-secondary">${kind === 'cnpj' ? 'Informe um CNPJ' : 'Informe pelo menos 3 caracteres'} e clique em Buscar.</div>`;
 } else if (!result.items.length) {
  content = `<div class="card-body py-4 text-body-secondary">Nenhum resultado em ${label.toLowerCase()} para esta consulta ou página.</div>`;
 } else {
  const rows = result.items.map((c,index) => `<tr><td><div class="fw-normal">${escapeHtml(c.name)}</div>${c.trade?`<div class="small text-body-secondary">${escapeHtml(c.trade)}</div>`:''}${kind==='partners'?`<div class="small text-body-secondary mt-1">Sócio: ${escapeHtml(c.partnerName||'Não informado')}<br>Documento: ${escapeHtml(c.partnerDocument||'Não informado')}<br>${partnerSearchButton(c.partnerName,c.partnerDocument)}</div>`:''}</td><td class="text-nowrap font-monospace">${format(c.id)}${copyButton(c.id)}</td><td class="text-nowrap">${escapeHtml([c.city,c.uf].filter(Boolean).join(' / ')||'Não informada')}</td><td>${statusBadge(c.status)}</td><td class="text-end"><button class="btn btn-sm btn-outline-primary text-nowrap" data-id="${c.id}" data-result-kind="${kind}" data-row="${index}">Ver detalhes<span class="visually-hidden"> de ${escapeHtml(c.name)}</span></button></td></tr>`).join('');
  content = `<div class="table-responsive-lg"><table class="table table-hover align-middle mb-0"><caption class="visually-hidden">Resultados por ${label.toLowerCase()}</caption><thead class="table-light"><tr><th scope="col">Empresa</th><th scope="col">CNPJ</th><th scope="col">Localização</th><th scope="col">Situação</th><th scope="col"><span class="visually-hidden">Ações</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
 }
 const p = result.pagination;
 let footer = '';
 if (p) {
  const pageButton = (target,text,disabled=false,current=false) => `<li class="page-item ${disabled?'disabled':''} ${current?'active':''}"><button type="button" class="page-link" data-kind="${kind}" data-page="${target}" ${disabled?'disabled':''} ${current?'aria-current="page"':''}>${text}</button></li>`;
  const visible = new Set([1,p.total_pages]);
  for (let n=p.page-2;n<=p.page+2;n++) if (n>0&&n<=p.total_pages) visible.add(n);
  let last=0,numbers='';
  for (const n of [...visible].filter(n=>n>0).sort((a,b)=>a-b)) {
   if (last&&n-last>1) numbers+='<li class="page-item disabled"><span class="page-link">…</span></li>';
   numbers+=pageButton(n,n,false,n===p.page);
   last=n;
  }
  const start=(p.page-1)*p.page_size;
  const range=result.items.length?`${start+1}–${start+result.items.length} de ${p.total_items}`:`0 nesta página · ${p.total_items} no total`;
  footer=`<div class="card-footer bg-body d-flex flex-wrap justify-content-between align-items-center gap-2 py-3"><span class="small text-body-secondary">${range}</span><nav aria-label="Paginação de ${label}"><ul class="pagination pagination-sm mb-0">${pageButton(p.page-1,'Anterior',p.page<=1)}${numbers}${pageButton(p.page+1,'Próxima',p.total_pages===0||p.page>=p.total_pages)}</ul></nav></div>`;
 }
 return `<section class="card shadow-sm mb-4" aria-labelledby="title-${kind}" aria-busy="${result.loading}"><div class="card-header result-section-header d-flex justify-content-between align-items-center py-3"><h3 id="title-${kind}" class="h5 fw-bold mb-0">${label}</h3>${p?`<span class="badge text-bg-secondary">${p.total_items} ${unit}${p.total_items===1?'':'s'}</span>`:''}</div>${content}${footer}</section>`;
}

const statusStyles = {
 Ativa: {letter:'A',color:'text-success'},
 Baixada: {letter:'B',color:'text-danger'},
 Suspensa: {letter:'S',color:'text-warning-emphasis'},
 Inapta: {letter:'I',color:'text-danger'},
 Nula: {letter:'N',color:'text-danger'}
};
function statusBadge(status){
 const style=statusStyles[status]||{letter:'?',color:'text-secondary'};
 return `<span class="badge bg-light ${style.color}" title="${escapeHtml(status)}"><span aria-hidden="true">${style.letter}</span><span class="visually-hidden">${escapeHtml(status)}</span></span>`;
}
function statusLegend(){
 return `<div class="d-flex flex-wrap align-items-center gap-3 small text-body-secondary"><span class="fw-semibold">Situação cadastral:</span>${Object.keys(statusStyles).map(status=>`<span class="text-nowrap">${statusBadge(status)} <span aria-hidden="true">${status}</span></span>`).join('')}</div>`;
}
function render(){
 const notice = $('main [role="note"]');
 if (notice) notice.textContent = 'Consulte as empresas e abra os detalhes para visualizar os dados completos.';
 renderRemoteCompanies();
}
function resetPages(){Object.keys(state.pages).forEach(k=>state.pages[k]=1);}
function updateMode(){
 const cnpj=$('#mode').value==='cnpj';
 $('#query-label').textContent=cnpj?'CNPJ da empresa':'Nome para consulta';
 $('#query').placeholder=cnpj?'00.000.000/0001-00':'Digite um nome';
 $('#query').inputMode='text';
 $('#query').setCustomValidity('');
 $('#search-hint').textContent = cnpj
  ? 'Informe o CNPJ com ou sem pontuação. Valores menores que 14 caracteres recebem zeros à esquerda.'
  : $('#mode').value === 'all'
   ? 'Consulta razão social, nome fantasia e sócios, com paginações independentes. Digite pelo menos 3 caracteres.'
   : 'Digite pelo menos 3 caracteres. Com Manticore disponível, todos os termos são pesquisados no campo selecionado; caso contrário, a busca usa o início do nome no MySQL.';
}
$('#mode').addEventListener('change',()=>{
 cancelCompanySearch();
 cancelDetails();
 state.mode = $('#mode').value;
 state.query = '';
 state.partnerDocument = '';
 $('#query').value = '';
 resetRemoteResults();
 resetPages();updateMode();render();
});
$('#query').addEventListener('input',()=>$('#query').setCustomValidity(''));
$('#search-form').addEventListener('submit',e=>{
 e.preventDefault();
 let query=$('#query').value.trim();
 const mode=$('#mode').value;
 if(mode==='cnpj') {
  query=normalizeCnpj(query);
  if(!query.length||query.length>14){
   $('#query').setCustomValidity('Informe um CNPJ com até 14 letras ou números.');
   $('#query').reportValidity();return;
  }
  query=query.padStart(14,'0');
 } else if(query.length<3){
  $('#query').setCustomValidity('Digite pelo menos 3 caracteres.');
  $('#query').reportValidity();return;
 }
 cancelDetails();
 state.mode=mode;state.query=query;state.partnerDocument='';resetPages();loadSelectedPages();
});
$('#page-size').addEventListener('change',()=>{state.pageSize=Number($('#page-size').value);resetPages();if(isRemoteMode()&&selectedKinds().some(kind=>remoteResults[kind].searched)){loadSelectedPages();}else{render();}});
$('#results').addEventListener('click',e=>{
 if(e.target.closest('[data-clear-partner-filter]')){
  state.partnerDocument='';loadSelectedPages();return;
 }
 const page=e.target.closest('[data-page]');
 if(page){if(!page.disabled)loadCompanyPage(Number(page.dataset.page),page.dataset.kind);return;}
 const button=e.target.closest('[data-id]');
 if(button)openCompany(button.dataset.id);
});
const field=(label,value)=>`<div class="col-sm-6"><dt class="modal-field-label fw-semibold mb-1">${escapeHtml(label)}</dt><dd class="mb-0">${escapeHtml(value===null||value===undefined||value===''?'Não informado':value)}</dd></div>`;
// Uma consulta por clique. O resultado não é guardado para reabertura da modal.
let detailsController = null;
function cancelDetails(){
 detailsController?.abort();
 detailsController=null;
}
async function fetchCompanyDetails(cnpj, signal){
 const response=await fetch('/api/companies/'+encodeURIComponent(cnpj),{cache:'no-store',signal});
 let payload;
 try {payload=await response.json();}
 catch {throw Error('O Explorer retornou uma resposta inválida para o CNPJ.');}
 if(!response.ok){
  const messages={
   COMPANY_NOT_FOUND:'Nenhuma empresa encontrada para este CNPJ.',
   INVALID_CNPJ:'O CNPJ informado é inválido.',
   API_ERROR:'Não foi possível consultar a API. Confira a conexão na página de configurações.'
  };
  throw Error(messages[payload.error?.code] || payload.error?.message || (response.status===404?'Nenhuma empresa encontrada para este CNPJ.':'Não foi possível carregar os detalhes da empresa.'));
 }
 if(!payload.company || typeof payload.company.corporate_name!=='string' ||
    !payload.establishment || !/^[A-Z0-9]{14}$/.test(payload.establishment.cnpj) ||
    (payload.partners!==null && !Array.isArray(payload.partners))){
  throw Error('A API retornou dados de empresa inválidos.');
 }
 return payload;
}
function summaryFromDetails(data){
 const e=data.establishment;
 return fromAPI({cnpj:e.cnpj,corporate_name:data.company.corporate_name,
  trade_name:e.trade_name,municipality:e.address?.municipality,state:e.address?.state,
  registration_status:e.registration?.status});
}
const dateBR=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(0,4):value;
const description=value=>value?[value.code,value.description].filter(v=>v!==null&&v!==undefined&&v!=='').join(' · '):null;
const yesNo=value=>value===true?'Sim':value===false?'Não':null;
function currency(value){
 if(value===null||value===undefined||value==='')return null;
 const match=String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
 if(!match)return value;
 return 'R$ '+match[1].replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+(match[2]||'').padEnd(2,'0');
}
function phone(value){
 if(!value?.number)return null;
 return [value.area_code?'('+value.area_code+')':'',value.number].filter(Boolean).join(' ');
}
const definitionList=entries=>`<dl class="row g-4 mb-0">${entries.map(([label,value])=>field(label,value)).join('')}</dl>`;
function sectionTitle(title){return `<h4 class="h6 modal-field-label fw-semibold mt-4 mb-3">${escapeHtml(title)}</h4>`;}
function renderCompanyDetails(data){
 const c=data.company,e=data.establishment,r=e.registration||{},a=e.address||{},contacts=e.contacts||{};
 const activities=e.economic_activities||{},tax=data.simple_tax;
 const summary=summaryFromDetails(data);
 const type=e.type==='headquarters'?'Matriz':e.type==='branch'?'Filial':e.type;
 $('#company-heading').innerHTML=`<h3 class="h5 fw-normal">${escapeHtml(c.corporate_name)}</h3><div class="d-flex flex-wrap gap-2 align-items-center"><span class="font-monospace">${format(e.cnpj)}${copyButton(e.cnpj)}</span>${type?`<span class="badge text-bg-secondary">${escapeHtml(type)}</span>`:''}${statusBadge(summary.status)}</div>`;
 const cadastro=definitionList([
  ['Razão social',c.corporate_name],['Nome fantasia',e.trade_name],
  ['CNPJ',format(e.cnpj)],['Data de abertura',dateBR(e.activity_start_date)],
  ['Situação cadastral',description(r.status)],['Data da situação cadastral',dateBR(r.status_date)],
  ['Motivo da situação cadastral',description(r.status_reason)],
  ['Situação especial',r.special_status],['Data da situação especial',dateBR(r.special_status_date)],
  ['Natureza jurídica',description(c.legal_nature)],['Porte',description(c.company_size)],
  ['Capital social',currency(c.share_capital)],['Qualificação do responsável',description(c.responsible_qualification)],
  ['Ente federativo responsável',c.responsible_federative_entity]
 ]);
 const simples=tax?sectionTitle('Simples Nacional')+definitionList([
  ['Opção pelo Simples Nacional',yesNo(tax.is_opted)],['Data de opção',dateBR(tax.option_date)],
  ['Data de exclusão',dateBR(tax.exclusion_date)]
 ])+'<hr class="my-4">'+sectionTitle('MEI')+definitionList([
  ['Opção pelo MEI',yesNo(tax.mei?.is_opted)],['Data de opção pelo MEI',dateBR(tax.mei?.option_date)],
  ['Data de exclusão do MEI',dateBR(tax.mei?.exclusion_date)]
 ]):'<p class="text-body-secondary mb-0">Dados não informados pela API.</p>';
 const endereco=definitionList([
  ['Tipo de logradouro',a.street_type],['Logradouro',a.street],['Número',a.number],
  ['Complemento',a.complement],['Bairro',a.neighborhood],
  ['CEP',typeof a.postal_code==='string'?a.postal_code.replace(/^(\d{5})(\d{3})$/,'$1-$2'):a.postal_code],
  ['Município',description(a.municipality)],['UF',a.state],['País',description(a.country)],
  ['Cidade no exterior',a.foreign_city_name]
 ]);
 const phones=Array.isArray(contacts.phones)?contacts.phones:[];
 const contatos=definitionList([
  ['E-mail',contacts.email],...phones.map((p,i)=>['Telefone '+(i+1),phone(p)]),
  ...(!phones.length?[['Telefone',null]]:[]),['Fax',phone(contacts.fax)]
 ]);
 const secondary=Array.isArray(activities.secondary)?activities.secondary:[];
 const atividade=definitionList([['Atividade principal',description(activities.primary)]])+sectionTitle('Atividades secundárias')+
  (secondary.length?`<ul class="list-group">${secondary.map(item=>`<li class="list-group-item">${escapeHtml(description(item)||'Não informada')}</li>`).join('')}</ul>`:'<p class="text-body-secondary mb-0">Nenhuma atividade secundária informada.</p>');
 const socios=Array.isArray(data.partners)&&data.partners.length?'<div class="accordion" id="partners-accordion">'+data.partners.map((p,index)=>{
  const representative=p.legal_representative;
  const id='partner-'+index;
  return `<div class="accordion-item"><h4 class="accordion-header" id="${id}-heading"><button class="accordion-button collapsed fw-normal" type="button" data-bs-toggle="collapse" data-bs-target="#${id}-details" aria-expanded="false" aria-controls="${id}-details">${escapeHtml(p.name||'Nome não informado')}</button></h4><div id="${id}-details" class="accordion-collapse collapse" aria-labelledby="${id}-heading" data-bs-parent="#partners-accordion"><div class="accordion-body"><div class="mb-3">${partnerSearchButton(p.name,p.document)}</div>${definitionList([
   ['Documento',p.document],['Tipo',description(p.type)],
   ['Qualificação',description(p.qualification)],['Data de entrada',dateBR(p.entry_date)],
   ['Faixa etária',description(p.age_range)],['País',description(p.country)]
  ])}${representative?sectionTitle('Representante legal')+definitionList([
   ['Nome do representante',representative.name],['Documento do representante',representative.document],
   ['Qualificação do representante',description(representative.qualification)]
  ]):''}</div></div></div>`;
 }).join('')+'</div>':'<p class="text-body-secondary mb-0">Nenhum sócio informado pela API.</p>';
 showCompanyTabs([
  ['cadastro','Cadastro',cadastro],['endereco','Endereço',endereco],
  ['contatos','Contatos',contatos],['atividades','Atividades',atividade],
  ['simples','Simples e MEI',simples],['socios','Sócios',socios]
 ]);
}
async function openCompany(cnpj){
 if(!/^[A-Z0-9]{14}$/.test(cnpj))return;
 cancelDetails();
 const controller=new AbortController();
 detailsController=controller;
 $('#company-heading').innerHTML=`<span class="font-monospace">${format(cnpj)}${copyButton(cnpj)}</span>`;
 $('#detail-tabs').innerHTML='';
 $('#detail-content').innerHTML='<div class="py-4" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Carregando os detalhes da empresa...</div>';
 const note=$('#company-modal .modal-footer .small');
 if(note)note.textContent='Dados consultados na API.';
 bootstrap.Modal.getOrCreateInstance($('#company-modal')).show();
 try {
  const data=await fetchCompanyDetails(cnpj,controller.signal);
  if(detailsController!==controller||controller.signal.aborted)return;
  renderCompanyDetails(data);
 } catch(error){
  if(detailsController!==controller||controller.signal.aborted)return;
  $('#detail-content').innerHTML=`<div class="alert alert-danger" role="alert">${escapeHtml(error.message||'Não foi possível comunicar com o Explorer.')}</div><button type="button" class="btn btn-outline-primary" data-retry-cnpj="${cnpj}">Tentar novamente</button>`;
 } finally {
  if(detailsController===controller)detailsController=null;
 }
}
$('#detail-content').addEventListener('click',e=>{
 const retry=e.target.closest('[data-retry-cnpj]');
 if(retry)openCompany(retry.dataset.retryCnpj);
});
$('#company-modal').addEventListener('hide.bs.modal',cancelDetails);

function showCompanyTabs(tabs){
 $('#detail-tabs').innerHTML=tabs.map(([id,title],i)=>`<li class="nav-item" role="presentation"><button class="nav-link text-nowrap ${i===0?'active':''}" id="tab-${id}" data-bs-toggle="tab" data-bs-target="#pane-${id}" type="button" role="tab" aria-controls="pane-${id}" aria-selected="${i===0}">${title}</button></li>`).join('');
 $('#detail-content').innerHTML=tabs.map(([id,title,content],i)=>`<div class="tab-pane fade ${i===0?'show active':''}" id="pane-${id}" role="tabpanel" aria-labelledby="tab-${id}" tabindex="0"><h4 class="visually-hidden">${title}</h4>${content}</div>`).join('');
 bootstrap.Modal.getOrCreateInstance($('#company-modal')).show();
}
$('#mode').value='all';
updateMode();render();

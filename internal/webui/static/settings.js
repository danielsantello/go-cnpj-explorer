'use strict';
const defaults = {apiUrl:'http://localhost:8080',timeoutSeconds:30};
const form = document.querySelector('#settings-form');
const urlInput = document.querySelector('#api-url');
const timeoutInput = document.querySelector('#api-timeout');
const statusBox = document.querySelector('#settings-status');
function notify(message,error=false){
 statusBox.className='alert '+(error?'alert-danger':'alert-success');
 statusBox.textContent=message;statusBox.hidden=false;
}
function fill(values){urlInput.value=values.apiUrl;timeoutInput.value=values.timeoutSeconds;urlInput.setCustomValidity('');}
function validateSettings(apiUrl,timeoutSeconds){
 const url=new URL(apiUrl);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('Informe um endereço HTTP ou HTTPS, sem usuário, senha, parâmetros ou fragmentos.');
 if(!Number.isInteger(timeoutSeconds)||timeoutSeconds<1||timeoutSeconds>120)throw Error('O tempo limite deve ser um número inteiro entre 1 e 120 segundos.');
 return {apiUrl:url.href.replace(/\/+$/,''),timeoutSeconds};
}
fill(defaults);
const saveButton = form.querySelector('button[type="submit"]');

async function loadSettings() {
	saveButton.disabled = true;

	try {
		const response = await fetch('/api/config', {
			cache: 'no-store'
		});

		if (!response.ok) {
			throw new Error('Não foi possível carregar a configuração.');
		}

		const cfg = await response.json();

		const values = validateSettings(
			cfg.api_url,
			cfg.timeout_seconds
		);

		fill(values);
		saveButton.disabled = false;
	} catch (error) {
		notify(
			'Não foi possível carregar a configuração. Recarregue a página para tentar novamente.',
			true
		);
	}
}

loadSettings();

urlInput.addEventListener('input', () => {
	urlInput.setCustomValidity('');
});

form.addEventListener('submit', async event => {
	event.preventDefault();

	if (saveButton.disabled || !form.reportValidity()) {
		return;
	}

	let values;

	try {
		values = validateSettings(
			urlInput.value.trim(),
			Number(timeoutInput.value)
		);
	} catch (error) {
		notify(error.message, true);
		return;
	}

	saveButton.disabled = true;

	try {
		const response = await fetch('/api/config', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				api_url: values.apiUrl,
				timeout_seconds: values.timeoutSeconds
			})
		});

		if (!response.ok) {
			const message = await response.text();
			throw new Error(message || 'Não foi possível salvar a configuração.');
		}

		fill(values);
        resetHealth();
		notify('Configurações salvas com sucesso.');
	} catch (error) {
		notify(error.message, true);
	} finally {
		saveButton.disabled = false;
	}
});

document.querySelector('#restore-defaults').addEventListener('click', () => {
	fill(defaults);
	notify('Valores padrão preenchidos. Clique em Salvar configurações para confirmar.');
});

const serviceList = document.querySelector('#health-services');
const healthSummary = document.querySelector('#health-summary');
const healthTime = document.querySelector('#health-checked-at');
const checkButton = document.querySelector('#check-health');

let healthController = null;
let healthVersion = 0;

function renderServices(services) {
	serviceList.innerHTML = services.map(([name, color, label, description]) => `
		<li class="list-group-item px-0 py-3">
			<div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
				<span class="fw-semibold">${name}</span>
				<span class="text-${color} d-inline-flex align-items-center gap-2 small fw-semibold">
					<svg width="10" height="10" viewBox="0 0 10 10"
						fill="currentColor" aria-hidden="true">
						<circle cx="5" cy="5" r="5"/>
					</svg>
					${label}
				</span>
			</div>
			<p class="small text-body-secondary mt-1 mb-0">${description}</p>
		</li>
	`).join('');
}

function serviceIndicator(name, status) {
	if (status === 'available') {
		return [name, 'success', 'Disponível', 'O serviço está disponível.'];
	}

	if (status === 'unavailable') {
		return [name, 'danger', 'Indisponível', 'A API informou que o serviço está indisponível.'];
	}

	if (status === 'disabled' || status === 'not_configured') {
		return [name, 'secondary', 'Não configurado', 'O serviço está desabilitado ou não foi configurado.'];
	}

	return [name, 'secondary', 'Não verificado', 'A API não informou um estado reconhecido para este serviço.'];
}

function resetHealth() {
	healthVersion++;
	healthController?.abort();
	healthController = null;

	checkButton.disabled = false;
	checkButton.textContent = 'Verificar conexão';

	renderServices(['API', 'MySQL', 'Manticore'].map(name => [
		name,
		'secondary',
		'Não verificado',
		'Aguardando verificação.'
	]));

	healthSummary.textContent = 'A verificação usa as configurações salvas.';
	healthTime.textContent = 'Nenhuma verificação realizada para os valores atuais.';
}

checkButton.addEventListener('click', async () => {
	if (checkButton.disabled) {
		return;
	}

	const version = ++healthVersion;
	const controller = new AbortController();
	healthController = controller;

	checkButton.disabled = true;
	checkButton.textContent = 'Verificando...';
	healthSummary.textContent = 'Consultando a API...';

	try {
		const response = await fetch('/api/health', {
			cache: 'no-store',
			signal: controller.signal
		});

		if (!response.ok && response.status !== 503) {
			const message = await response.text();
			throw new Error(message.trim() || 'Não foi possível verificar a conexão.');
		}

		const health = await response.json();

		if (!health.status || !health.services) {
			throw new Error('A resposta da verificação está incompleta.');
		}

		if (version !== healthVersion) {
			return;
		}

		renderServices([
			['API', 'success', 'Disponível', 'A API respondeu à verificação.'],
			serviceIndicator('MySQL', health.services.mysql?.status),
			serviceIndicator('Manticore', health.services.search?.status)
		]);

		healthSummary.textContent = health.status === 'healthy'
			? 'A API informou que está saudável.'
			: 'A API respondeu, mas informou uma condição que requer atenção.';
	} catch (error) {
		if (version !== healthVersion || error.name === 'AbortError') {
			return;
		}

		renderServices([
			['API', 'danger', 'Falha na verificação', 'Não foi possível confirmar o estado da API.'],
			['MySQL', 'secondary', 'Não verificado', 'Sem informações atualizadas da API.'],
			['Manticore', 'secondary', 'Não verificado', 'Sem informações atualizadas da API.']
		]);

		healthSummary.textContent = error.message;
	} finally {
		if (version === healthVersion) {
			healthController = null;
			checkButton.disabled = false;
			checkButton.textContent = 'Verificar conexão';
			healthTime.textContent = 'Última verificação: ' + new Date().toLocaleString('pt-BR');
		}
	}
});

[urlInput, timeoutInput].forEach(input => {
	input.addEventListener('input', resetHealth);
});

document.querySelector('#restore-defaults')
	.addEventListener('click', resetHealth);

resetHealth();

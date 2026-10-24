# go-cnpj-explorer

Interface para consultar empresas, estabelecimentos e sócios a partir dos dados públicos de CNPJ da Receita Federal, disponibilizados pelo [go-cnpj-api](https://github.com/danielsantello/go-cnpj-api).

Este guia explica como preparar o ambiente, instalar o Explorer, configurar a conexão e realizar consultas.

## Sumário

- [Antes de começar](#antes-de-começar)
- [Como os produtos trabalham juntos](#como-os-produtos-trabalham-juntos)
- [Preparar os dados e a API](#preparar-os-dados-e-a-api)
  - [Iniciar uma API já instalada](#iniciar-uma-api-já-instalada)
- [Instalar o Explorer](#instalar-o-explorer)
  - [Baixar e gerar o executável](#baixar-e-gerar-o-executável)
  - [Abrir o programa](#abrir-o-programa)
  - [Executar diretamente pelo código](#executar-diretamente-pelo-código)
- [Configurar a conexão](#configurar-a-conexão)
  - [Entender os indicadores de conexão](#entender-os-indicadores-de-conexão)
- [Fazer uma consulta](#fazer-uma-consulta)
  - [CNPJ](#cnpj)
  - [Razão social](#razão-social)
  - [Nome fantasia](#nome-fantasia)
  - [Sócios](#sócios)
  - [Busca geral](#busca-geral)
  - [Dicas para encontrar resultados](#dicas-para-encontrar-resultados)
- [Ler e navegar pelos resultados](#ler-e-navegar-pelos-resultados)
  - [Situação cadastral](#situação-cadastral)
- [Consultar os detalhes de uma empresa](#consultar-os-detalhes-de-uma-empresa)
- [Ver as empresas vinculadas a um sócio](#ver-as-empresas-vinculadas-a-um-sócio)
- [Encerrar e abrir novamente](#encerrar-e-abrir-novamente)
- [Atualizar o programa ou os dados](#atualizar-o-programa-ou-os-dados)
  - [Atualizar o Explorer](#atualizar-o-explorer)
  - [Atualizar a base consultada](#atualizar-a-base-consultada)
- [Resolver problemas comuns](#resolver-problemas-comuns)
  - [A página não abre](#a-página-não-abre)
  - [A página abre, mas as consultas falham](#a-página-abre-mas-as-consultas-falham)
  - [Aparece “endereço já está em uso”](#aparece-endereço-já-está-em-uso)
  - [A consulta demora ou ultrapassa o tempo limite](#a-consulta-demora-ou-ultrapassa-o-tempo-limite)
  - [A busca não encontra um nome que existe](#a-busca-não-encontra-um-nome-que-existe)
  - [As configurações não são salvas ou parecem ter sumido](#as-configurações-não-são-salvas-ou-parecem-ter-sumido)
  - [A interface continua com a aparência antiga](#a-interface-continua-com-a-aparência-antiga)
  - [O nome fantasia ou outro campo não aparece](#o-nome-fantasia-ou-outro-campo-não-aparece)
- [Projeto e ajuda](#projeto-e-ajuda)

## Antes de começar

O Explorer foi pensado para uso local, no seu computador. Ele abre no navegador e não possui login nem controle de acesso. **Não é recomendado publicá-lo na internet.**

O Explorer precisa de uma API em execução e de uma base de dados preparada. Ele não consulta diretamente o site da Receita Federal nem baixa a base de CNPJ.

Se alguém já disponibilizou uma API compatível para você, pode ir diretamente para [Instalar o Explorer](#instalar-o-explorer).

## Como os produtos trabalham juntos

- **[go-cnpj-loader](https://github.com/danielsantello/go-cnpj-loader):** baixa os arquivos públicos da Receita Federal e carrega os dados no MySQL.
- **[go-cnpj-api](https://github.com/danielsantello/go-cnpj-api):** recebe as consultas e devolve as informações da base preparada.
- **go-cnpj-explorer:** oferece a tela de pesquisa e apresenta os resultados no navegador.

O Loader é usado na preparação e na atualização dos dados. Ele não precisa ficar aberto enquanto você pesquisa. A API e o Explorer precisam permanecer em execução durante o uso, e o MySQL precisa estar disponível para a API.

O Manticore Search é opcional. Quando disponível e configurado na API, ele permite buscar palavras em diferentes posições dos nomes. Sem ele, as buscas específicas usam o início do nome no MySQL. O Explorer não exige que você selecione o mecanismo de pesquisa.

## Preparar os dados e a API

Se você vai instalar todos os produtos no mesmo computador, siga esta ordem:

1. Prepare o MySQL conforme as instruções do Loader.
2. Use o Loader para baixar e carregar uma publicação completa da Receita Federal.
3. Configure a API para usar a base cuja carga foi concluída.
4. Crie os índices de consulta conforme as instruções da API.
5. Inicie a API.
6. Instale e abra o Explorer.

Use os guias dos próprios produtos para essa preparação:

- [Instalação e uso do Loader](https://github.com/danielsantello/go-cnpj-loader#readme).
- [Preparação do MySQL](https://github.com/danielsantello/go-cnpj-loader/blob/main/docs/operacao/mysql.md).
- [Instalação e configuração da API](https://github.com/danielsantello/go-cnpj-api#readme).
- [Configuração opcional da busca com Manticore](https://github.com/danielsantello/go-cnpj-api/blob/main/docs/search.md).

A importação inicial envolve um volume grande de dados. Planeje espaço em disco e tempo para concluir a carga antes de usar o Explorer.

### Iniciar uma API já instalada

Se a API está em `~/projects/go-cnpj-api`, já foi configurada e usa um arquivo `.env`, abra um terminal e execute:

```bash
clear
cd ~/projects/go-cnpj-api
set -a
source .env
set +a
go run ./cmd/cnpj-api serve
```

O exemplo usa Bash. A API não lê o `.env` automaticamente: os comandos acima carregam a configuração no terminal antes de iniciar o programa.

Deixe esse terminal aberto. Por padrão, o endereço da API é `http://localhost:8080`.

Se a instalação usa outro diretório ou outra forma de execução, siga as instruções adotadas nesse ambiente.

## Instalar o Explorer

As instruções abaixo usam Linux e Bash. Para compilar o programa, você precisa de **Go 1.27.0 ou superior** e **Git** instalados.

### Baixar e gerar o executável

Escolha uma pasta para os projetos. Neste exemplo, usaremos `~/projects`:

```bash
clear
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/danielsantello/go-cnpj-explorer.git
cd go-cnpj-explorer
go build -o cnpj-explorer ./cmd/cnpj-explorer
```

O comando gera o executável `cnpj-explorer` na pasta do projeto. As páginas, os estilos e os scripts da interface ficam incluídos nele; não é necessário instalar Node.js nem um servidor web separado.

Se você já tem o código do projeto no computador, entre na pasta existente e execute apenas o comando de compilação.

### Abrir o programa

Em um terminal separado daquele que está executando a API, inicie o Explorer:

```bash
clear
cd ~/projects/go-cnpj-explorer
./cnpj-explorer
```

Deixe o terminal aberto e acesse no navegador:

**[http://127.0.0.1:8081](http://127.0.0.1:8081)**

O programa estará pronto para uso quando o terminal informar que o servidor está disponível nesse endereço.

O Go é necessário para compilar o programa. Depois de gerado, o executável pode ser usado sem o Go instalado, em um ambiente compatível com aquele para o qual foi compilado.

### Executar diretamente pelo código

Se preferir, você pode iniciar o Explorer sem gerar um executável separado:

```bash
clear
cd ~/projects/go-cnpj-explorer
go run ./cmd/cnpj-explorer
```

Escolha uma das duas formas de execução. Não inicie as duas ao mesmo tempo, pois elas usam a mesma porta.

## Configurar a conexão

1. Na tela principal, clique na engrenagem **Configurações**.
2. Em **Endereço da API**, informe o endereço base da API.
3. Em **Tempo limite da consulta**, informe quantos segundos o Explorer deve aguardar uma resposta.
4. Clique em **Salvar configurações**.
5. Clique em **Verificar conexão**.

Para a instalação padrão no mesmo computador, use:

- Endereço da API: `http://localhost:8080`.
- Tempo limite: `30` segundos.

Informe apenas o endereço base, sem acrescentar caminhos como `/v1/companies` ou `/health`. O tempo limite deve ser um número inteiro entre **1 e 120 segundos**.

Se a API estiver em outro computador, use o endereço fornecido por quem a instalou. Nesse caso, `localhost` não serve para apontar para essa outra máquina.

As configurações são salvas no arquivo **`config.json`**, na pasta de onde o Explorer foi iniciado. A pasta precisa permitir a gravação desse arquivo. Use sempre a mesma pasta para iniciar o programa e conservar suas preferências.

Não é necessário reiniciar o Explorer após salvar: as próximas consultas usam os valores salvos. O Explorer não configura o usuário ou a senha do MySQL; essa conexão pertence à configuração da API.

Para voltar aos valores iniciais, clique em **Restaurar valores padrão** e depois em **Salvar configurações**.

### Entender os indicadores de conexão

Em Configurações, a verificação apresenta a disponibilidade da API, do MySQL e do Manticore Search.

- **Verde:** o serviço respondeu à verificação.
- **Vermelho:** o serviço está indisponível ou não respondeu.
- **Cinza:** consulte o texto do indicador; o serviço pode estar desabilitado ou ainda não ter sido verificado.

Se o Manticore estiver desabilitado, as buscas por razão social, nome fantasia e sócios podem funcionar pelo MySQL. Se estiver configurado, mas indisponível, o indicador pode aparecer em vermelho e essas buscas ainda podem funcionar com a alternativa pelo MySQL.

A verificação de conexão confirma a disponibilidade dos serviços naquele momento. Ela não substitui a conclusão e a validação da carga dos dados.

Salve alterações de endereço ou tempo limite antes de verificar a conexão.

## Fazer uma consulta

Na tela principal, escolha o **Tipo de busca**, preencha o campo e clique em **Buscar**.

### CNPJ

Selecione **CNPJ** e informe o número, com ou sem a pontuação. Por exemplo:

```text
00.523.856/0001-41
```

O Explorer apresenta a empresa correspondente ao CNPJ consultado. Clique em **Ver detalhes** para abrir suas informações completas.

### Razão social

Selecione **Razão social** e digite pelo menos três caracteres do nome empresarial.

O resultado apresenta a razão social e, quando informado, o nome fantasia do estabelecimento correspondente ao CNPJ exibido.

### Nome fantasia

Selecione **Nome fantasia** e digite pelo menos três caracteres do nome usado pelo estabelecimento.

Cada resultado apresenta a razão social e o nome fantasia. Uma empresa pode ter diferentes estabelecimentos, com CNPJs e nomes fantasia próprios.

### Sócios

Selecione **Sócios** e digite pelo menos três caracteres do nome da pessoa ou empresa que participa de outra empresa.

Os resultados mostram o sócio encontrado, seu documento conforme disponível na base e a empresa vinculada. O mesmo sócio pode aparecer em várias linhas porque participa de diferentes empresas. Documentos mascarados são apresentados com a máscara fornecida pela API.

### Busca geral

Selecione **Busca geral** para pesquisar o mesmo texto em razão social, nome fantasia e sócios.

Os resultados aparecem em três blocos, um abaixo do outro. **Cada bloco tem sua própria contagem e paginação.** Avançar a página de um bloco não altera os demais.

A mesma empresa pode aparecer em mais de um bloco. Isso significa que ela foi encontrada por critérios diferentes. As contagens dos blocos não representam um total de empresas únicas.

Se um bloco apresentar erro, os outros podem continuar exibindo seus resultados. Use **Tentar novamente** no bloco que falhou.

### Dicas para encontrar resultados

Com o Manticore disponível, a pesquisa por nomes considera palavras em diferentes posições, sem exigir que o texto seja o início do nome. Todos os termos informados são exigidos no campo pesquisado.

Quando a consulta usa o MySQL, pesquise pelo **início do nome**. Se um trecho no meio do nome não encontrar resultados, tente as primeiras palavras.

As buscas por nome permitem até **1.000 resultados por consulta**. Se o sistema pedir uma busca mais específica, acrescente palavras. Alterar a quantidade de itens por página não resolve uma consulta ampla demais.

## Ler e navegar pelos resultados

Cada linha apresenta o nome empresarial, o CNPJ, o município/UF e a situação cadastral. Campos sem informação na base podem aparecer vazios ou como não informados.

Use **Anterior**, os números das páginas e **Próxima** para navegar. O seletor **Itens por lista** altera quantos resultados são solicitados por página. Na busca geral, a alteração reinicia as três listas na primeira página.

Ao lado do CNPJ há um ícone para copiar. Ele copia o CNPJ **sem pontuação**, facilitando colar o valor em outra consulta ou aplicativo.

### Situação cadastral

A legenda da página explica as letras exibidas:

- **A:** Ativa.
- **B:** Baixada.
- **S:** Suspensa.
- **I:** Inapta.
- **N:** Nula.

Passe o cursor sobre o indicador para visualizar a descrição. Quando a situação não estiver informada, o Explorer pode apresentar `?`.

## Consultar os detalhes de uma empresa

Clique em **Ver detalhes** na linha desejada. O Explorer consulta o CNPJ e abre uma janela com seis abas:

- **Cadastro:** informações cadastrais, situação, abertura, natureza jurídica, porte e capital social.
- **Endereço:** logradouro, número, complemento, bairro, CEP e localização.
- **Contatos:** e-mail, telefones e fax, quando disponíveis.
- **Atividades:** atividade econômica principal e atividades secundárias.
- **Simples e MEI:** opção, data de opção e data de exclusão, quando informadas.
- **Sócios:** relação dos sócios e informações de participação.

Na aba Sócios, clique no nome para expandir seus dados. Os itens começam fechados. Ao abrir outro sócio, o anterior é recolhido.

Cada clique em **Ver detalhes** faz uma nova consulta à API. Depois que a janela termina de carregar, trocar de aba ou expandir um sócio não exige novas consultas.

Se ocorrer uma falha, clique em **Tentar novamente**. Para voltar à lista, use **Fechar** ou o botão de fechar no topo da janela.

Informação ausente não equivale a uma resposta negativa. Por exemplo, se a API não fornecer dados do Simples ou do MEI, o Explorer informa essa ausência, sem afirmar que a empresa não é optante.

## Ver as empresas vinculadas a um sócio

A ação **Ver empresas deste sócio** aparece nos resultados da busca por sócios e nos dados expandidos da aba Sócios, quando há nome e documento disponíveis.

1. Clique em **Ver empresas deste sócio**.
2. O Explorer fecha a janela de detalhes, se estiver aberta, e seleciona a busca por sócios.
3. A consulta combina o **nome e o documento** do sócio selecionado.
4. Confira o nome e o documento no aviso acima dos resultados.
5. Navegue pelas páginas para visualizar os vínculos encontrados.

O documento é utilizado exatamente como consta na base, incluindo a máscara. O filtro é mantido ao paginar e ao alterar os itens por página.

Para ampliar a pesquisa, clique em **Buscar somente pelo nome**. Uma nova consulta pelo formulário ou a troca do tipo de busca também remove o filtro de documento anterior.

## Encerrar e abrir novamente

Fechar a aba do navegador não encerra o Explorer. Para pará-lo, vá ao terminal onde ele está rodando e pressione **Ctrl+C**.

Na próxima utilização, confirme que o MySQL e a API estão disponíveis, inicie o Explorer e abra `http://127.0.0.1:8081` no navegador.

Não é necessário executar o Loader novamente a cada uso. Ele será necessário quando você quiser preparar uma nova publicação de dados.

## Atualizar o programa ou os dados

### Atualizar o Explorer

Encerre o Explorer antes de atualizar. Se sua instalação foi feita pelo Git e você não alterou o código localmente:

```bash
clear
cd ~/projects/go-cnpj-explorer
git pull --ff-only
go build -o cnpj-explorer ./cmd/cnpj-explorer
./cnpj-explorer
```

Se o Git informar conflito ou alterações locais, interrompa a atualização e revise essas alterações antes de continuar.

Preserve o arquivo `config.json` para manter suas preferências. Atualize a página com **Ctrl+F5** depois de iniciar a nova versão.

### Atualizar a base consultada

O Explorer mostra os dados da base usada pela API. Ele não atualiza cadastros automaticamente.

Para consultar uma nova publicação, use o Loader para concluir a carga, configure a API para a nova base e prepare os índices necessários. Se houver Manticore, atualize também suas cargas conforme o guia da API.

Se o endereço da API permanecer igual, não é necessário alterar a configuração do Explorer. A atualidade das informações depende da publicação carregada, e não da data da consulta na tela.

## Resolver problemas comuns

### A página não abre

Confira se o terminal do Explorer continua aberto e se a inicialização terminou sem erros. Use o endereço **`http://127.0.0.1:8081`**. A porta `8080` é o endereço padrão da API, não da interface.

Se aparecer uma mensagem equivalente a “não foi possível conectar à porta 8081”, inicie o Explorer novamente.

### A página abre, mas as consultas falham

Abra **Configurações**, confira o endereço salvo e clique em **Verificar conexão**. Confirme que a API está em execução e que o MySQL está disponível.

Na instalação padrão, a API usa `http://localhost:8080`. Um erro de conexão nessa porta indica que é preciso verificar a API; reiniciar apenas o Explorer não substitui essa etapa.

### Aparece “endereço já está em uso”

Pode haver outro Explorer rodando na porta `8081`, ou outro programa usando esse endereço. Confira os terminais abertos e encerre a execução anterior antes de iniciar uma nova.

### A consulta demora ou ultrapassa o tempo limite

Tente uma busca mais específica. Se o ambiente precisar de mais tempo, ajuste o limite em Configurações e salve. O máximo permitido é 120 segundos.

Se a demora persistir, confira a disponibilidade da API e a preparação dos dados e índices com quem instalou os serviços.

### A busca não encontra um nome que existe

Confira o tipo de busca selecionado e tente o início do nome. O comportamento pode mudar quando a API passa a usar o MySQL no lugar do Manticore.

Se estiver consultando vínculos de um sócio selecionado, confira também o documento indicado no aviso. Para ampliar a consulta, use **Buscar somente pelo nome**.

### As configurações não são salvas ou parecem ter sumido

Confira se a pasta de execução permite gravar `config.json` e se você iniciou o Explorer na mesma pasta usada anteriormente. Clique em **Salvar configurações** e verifique a mensagem exibida.

### A interface continua com a aparência antiga

Depois de atualizar o programa, pare a execução antiga e abra a nova. No navegador, pressione **Ctrl+F5**.

### O nome fantasia ou outro campo não aparece

O Explorer só mostra o que a API devolve. O nome fantasia pode não estar preenchido para aquele estabelecimento. Se o dado aparece na consulta por CNPJ, mas não na busca por razão social para o mesmo CNPJ, confira se a API foi atualizada e reiniciada com suporte ao campo nas buscas.

## Projeto e ajuda

- [go-cnpj-explorer](https://github.com/danielsantello/go-cnpj-explorer).
- [go-cnpj-api](https://github.com/danielsantello/go-cnpj-api).
- [go-cnpj-loader](https://github.com/danielsantello/go-cnpj-loader).

Ao relatar um problema, informe o produto envolvido, a versão em uso, o tipo de consulta e a mensagem recebida. Inclua as etapas necessárias para reproduzir o comportamento e evite enviar senhas ou arquivos com credenciais.

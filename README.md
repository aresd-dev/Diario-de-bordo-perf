# Diário de Bordo — otimização de performance

PWA para criar, listar e remover atividades diárias, com persistência em localStorage, instalação e funcionamento offline. O projeto utiliza HTML, CSS e JavaScript, sem framework ou dependências de execução no navegador.

## Execução

Requer Node.js 22 ou superior.

```sh
npm ci
npm run build
npm run dev
```

A aplicação fica disponível em **http://localhost:8081**. `src/` contém o código editável e `dist/` contém a versão minificada. Após alterar os fontes, execute o build novamente. O modo offline e a instalação exigem localhost ou HTTPS.

## Estrutura

```text
src/                    Código-fonte e imagens originais
dist/                   Aplicação otimizada, pronta para hospedagem
tools/                  Build, servidor, auditoria e benchmark
docs/baseline/          Cópia da aplicação antes das alterações
docs/relatorios/        Prints, relatórios completos e comparação
docs/relatorios/medicoes/  Dados das seis execuções do Lighthouse
```

## Diagnóstico

O cenário principal representa um ano de uso: 365 atividades de teste, com os mesmos títulos, descrições e datas nas duas versões. Esses dados são inseridos apenas pelos scripts de medição e não acompanham a aplicação publicada.

- **Formatação de datas:** a listagem criava 365 instâncias de `Intl.DateTimeFormat` a cada atualização. Um benchmark isolado confirmou o custo dessa operação.
- **Lista extensa:** o Lighthouse identificou 2.226 elementos no DOM. O navegador calculava o layout de todos os cartões, inclusive fora da tela.
- **Eventos repetidos:** cada entrada recebia uma função de clique própria para remoção.
- **Imagem superdimensionada:** o cabeçalho exibia um PNG de 192×192 pixels em uma área de 42×42 pixels.
- **Arquivos sem minificação:** HTML, CSS, JavaScript e manifest eram servidos com a formatação dos fontes.
- **CSS bloqueante e compressão HTTP:** o relatório também apontou a folha de estilos no caminho crítico e ausência de compressão de texto no servidor de teste.

## Alterações

1. Reutilização de uma única instância de `Intl.DateTimeFormat`.
2. Montagem da lista em `DocumentFragment` e substituição em uma única operação.
3. Delegação do evento de remoção para a lista, eliminando as funções de clique individuais.
4. `content-visibility: auto` e `contain-intrinsic-size` nos cartões, adiando o layout dos registros fora da área visível.
5. Conversão da imagem do cabeçalho para WebP sem perdas, redimensionada para 84×84 pixels para atender telas com densidade 2×. O tamanho exibido permanece 42×42.
6. Compressão dos ícones PNG de instalação, mantendo as resoluções de 192×192 e 512×512.
7. Minificação de HTML com html-minifier-terser, CSS com clean-css e JavaScript com Terser. O manifest também é compactado.
8. Remoção da classe sem uso `entries-section` e atualização dos arquivos precacheados pelo service worker.

As ferramentas de build ficam em `devDependencies`. Não havia bibliotecas pesadas no navegador para substituir nem imports mortos. Os estilos de formulário, erro, foco, instalação e responsividade foram preservados, pois são usados em estados diferentes da aplicação.

### Carregamento adiado

A única imagem de conteúdo está no cabeçalho, visível desde o primeiro carregamento. Não foi aplicado `loading="lazy"` a ela, pois isso atrasaria uma imagem já necessária. Não há imagens abaixo da dobra nem iframes. O adiamento foi aplicado à renderização dos cartões com `content-visibility`. Essa decisão segue a [orientação sobre imagens visíveis no primeiro carregamento](https://web.dev/learn/performance/lazy-load-images-and-iframe-elements).

## Método de medição

- Data: 22/09/2026.
- Lighthouse 12.8.2 executado programaticamente com Chrome for Testing 147.0.7727.57, em modo headless e sem extensões.
- Perfil mobile de 412×823 pixels, densidade 1,75, rede simulada com RTT de 150 ms e throughput de 1.638,4 Kbps; CPU simulada 4× mais lenta.
- Três execuções consecutivas por versão, sempre com um perfil novo, sem cache ou service worker previamente instalado.
- Mesmo servidor HTTP local, endereço, configuração e conjunto de 365 registros. Não foi ativada compressão HTTP em nenhuma versão.
- `disableStorageReset` preserva os registros previamente inseridos; o perfil novo evita reaproveitar caches entre execuções.
- A tabela apresenta a mediana de cada métrica. Nenhuma execução foi descartada. As notas e tempos são medições de laboratório, sujeitos a variação.

O relatório anterior obtido pelo IP da rede não foi utilizado nesta comparação: endereço, extensões e condições de execução seriam diferentes.

## Comparativo Lighthouse

| Métrica | Antes | Depois | Variação |
|---|---:|---:|---:|
| Desempenho | 100 | 100 | Mantido |
| Acessibilidade | 100 | 100 | Mantida |
| Boas práticas | 100 | 100 | Mantidas |
| SEO | 100 | 100 | Mantido |
| LCP | 1.097,7 ms | 1.016,0 ms | −7,4% |
| FCP | 1.097,7 ms | 1.016,0 ms | −7,4% |
| TBT | 91,5 ms | 11,0 ms | −88,0% |
| CLS | 0 | 0 | Mantido |
| Transferência observada | 15.569 B | 13.070 B | −16,1% |
| Requisições observadas | 8 | 8 | Mantidas |

A pontuação inicial já estava no teto. O ganho está nos tempos, no bloqueio da thread principal e no volume transferido, não em um aumento artificial da nota.

### Execuções individuais

| Versão / execução | Desempenho | FCP (ms) | LCP (ms) | TBT (ms) | CLS | Bytes |
|---|---:|---:|---:|---:|---:|---:|
| Antes 1 | 100 | 757,3 | 1.085,3 | 91,5 | 0,004349 | 16.298 |
| Antes 2 | 100 | 1.097,7 | 1.097,7 | 0 | 0 | 15.569 |
| Antes 3 | 99 | 1.097,7 | 1.097,7 | 108 | 0 | 15.569 |
| Depois 1 | 100 | 1.013,2 | 1.013,2 | 45 | 0 | 13.722 |
| Depois 2 | 100 | 1.016,4 | 1.016,4 | 0 | 0 | 13.070 |
| Depois 3 | 100 | 1.016,0 | 1.016,0 | 11 | 0 | 13.070 |

A variação de TBT e FCP mostra por que um único resultado não deve ser tratado como garantia. A transferência observada depende das requisições capturadas durante cada auditoria e não equivale ao tamanho de todos os arquivos da aplicação.

### Relatórios e prints

Os prints correspondem às execuções com o TBT mediano: antes 1 e depois 3. São execuções individuais; a tabela principal combina medianas de três execuções. O Lighthouse arredonda alguns valores na apresentação.

**Antes** — [relatório completo](docs/relatorios/antes.html)

![Lighthouse antes das otimizações](docs/relatorios/antes.png)

**Depois** — [relatório completo](docs/relatorios/depois.html)

![Lighthouse depois das otimizações](docs/relatorios/depois.png)

Os [JSONs originais](docs/relatorios/medicoes/) permitem verificar as métricas, condições e auditorias. O [comparativo estruturado](docs/relatorios/comparativo.json) reúne as medianas e tamanhos dos arquivos.

## Impacto das alterações na listagem

Um segundo teste isolou `render()` e o cálculo de layout, com CPU 4× mais lenta. Foram coletadas sete amostras após um aquecimento, sem service worker, para cada versão. A variante intermediária modifica apenas a reutilização do formatador de datas; ela não faz parte da aplicação final.

| Cenário com 365 registros | JavaScript, mediana | JavaScript + layout, mediana |
|---|---:|---:|
| Original | 124,5 ms | 183,5 ms |
| Apenas formatador reutilizado | 17,0 ms | 75,1 ms |
| Todas as otimizações | 22,6 ms | 35,0 ms |

A reutilização do formatador trouxe a maior redução isolada de JavaScript. As demais alterações reduziram principalmente o custo de layout; não foram medidas separadamente entre si. A versão completa reduziu o tempo total em **80,9%**. A mediana da lista vazia permaneceu em **0,9 ms**, sem ganho relevante nesse cenário. Esse benchmark não mede INP nem substitui o Lighthouse. As amostras estão em [benchmark.json](docs/relatorios/benchmark.json).

## Tamanho dos recursos

| Arquivo | Antes | Depois |
|---|---:|---:|
| HTML | 2.764 B | 2.435 B |
| CSS | 4.637 B | 4.034 B |
| JavaScript da aplicação | 6.235 B | 5.143 B |
| Service worker | 1.240 B | 976 B |
| Manifest | 520 B | 443 B |
| Ícone PNG 192 | 1.139 B | 369 B |
| Ícone PNG 512 | 3.892 B | 1.093 B |
| WebP do cabeçalho | — | 664 B |
| **Total da aplicação** | **20.427 B** | **15.157 B** |

Redução total de **25,8%** em disco. O recurso visual do cabeçalho passou de 1.139 B para 664 B, redução de **41,7%**. Fontes, relatórios e ferramentas de desenvolvimento não entram no total.

## Reproduzir as medições

Após `npm ci` e `npm run build`, defina `CHROME_PATH` com o executável do Chrome instalado. Exemplo no PowerShell:

```powershell
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run audit -- antes
npm run audit -- depois
npm run benchmark
npm run reports
```

Os scripts usam as portas locais 4175 e 4176. Cada auditoria cria um perfil temporário em `.audit/` e grava os resultados em `docs/relatorios/`. Novas execuções substituem as evidências; os números do README devem ser atualizados de acordo com os resultados. A reprodução exata requer as mesmas versões de Chrome e ferramentas, mas os tempos ainda podem variar conforme a máquina.

## Validação e limites

Na versão minificada foram verificados criação, listagem, remoção, cancelamento, persistência após recarga, cadastro em HTTP comum, recarga e operações offline em localhost, manifest, critérios de instalação e larguras de 320, 375, 768 e 1440 pixels.

O DOM continua com todos os registros para preservar a navegação e a busca na página. `content-visibility` reduz o trabalho de renderização, mas não a contagem de elementos. A folha de estilos continua bloqueante, agora menor. Compressão HTTP e políticas de cache de produção permanecem dependentes da hospedagem. Não foi atribuída a essas melhorias não implementadas nenhuma redução nas métricas.

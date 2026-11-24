# Controle Financeiro (Electron)

## Rodar para testar
1. Instale o Node.js (versão LTS) em nodejs.org
2. Na pasta do projeto: `npm install`
3. `npm start`

## Gerar o instalador do Windows (.exe)
Faça isso em um PC com Windows:
1. `npm install`
2. `npm run dist` (gera só o instalador, em `dist/`)
3. Em `dist/` sai o instalador (`Controle-Financeiro-Setup-x.y.z.exe`).

## Onde ficam os dados
`%APPDATA%\Controle Financeiro\` (arquivo JSON + pasta de backups automáticos diários).
Também há "Salvar cópia de segurança" / "Restaurar cópia" no menu lateral.

## Migrar da planilha
Botão "Importar planilha" -> escolha o Excel antigo. Pode importar mais de uma vez sem duplicar.

## Testes
`npm test` (lógica, importação, exportação, backup).

## Lançar uma nova versão (atualização automática)
Os programas instalados verificam sozinhos os Releases deste repositório e se atualizam.
1. Altere o `"version"` no `package.json` (exemplo: `1.1.1`) e faça o commit.
2. Crie a tag e envie: `git tag v1.1.1` e `git push origin main v1.1.1`
3. O GitHub Actions compila o instalador e cria o Release sozinho (aba *Actions* mostra o andamento).
4. Em até 4 horas, os programas instalados baixam a versão nova e avisam "Atualizar". A tag precisa ser igual à versão do `package.json`.

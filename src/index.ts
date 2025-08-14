import { Elysia, t } from 'elysia';
import { html } from '@elysiajs/html'
import { Eta } from 'eta';
import YAML from 'yaml';
import * as fs from 'node:fs'
import * as openpgp from 'openpgp';
import path from 'node:path';

const app = new Elysia()
app.use(html())
const config = YAML.parse(fs.readFileSync('config.yaml', 'utf-8'))
const eta = new Eta({ views: path.join(__dirname, '../templates') })

app.get('/', () => {
  return eta.render('index', { showPassword: Boolean(config.private_key) })
})
app.post('/', async ({ body: { text, files, password } }) => {
  if (text.trim() == '') return 'no content'
  if (password?.trim() == '' && config.private_key) return 'no password provided'
  
  const creationDate = new Date()
  const publicKey = await openpgp.readKey({ armoredKey: config.public_key });
  const privateKey = config.private_key ? await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: config.private_key }),
    passphrase: password
  }) : undefined
  const encrypted = await openpgp.encrypt({
    message: await openpgp.createMessage({ text: `${creationDate.getTime()}\n\n${text}` }), 
    encryptionKeys: publicKey,
    signingKeys: privateKey
  });

  const datePathPrefix = `${creationDate.getFullYear()}${padTheNumber((creationDate.getMonth() + 1).toString(), 2)}${padTheNumber(creationDate.getDate().toString(), 2)}`
  const notesToday = fs.readdirSync('./output').filter(f => f.startsWith(datePathPrefix) && f.endsWith('.txt'))
  const latestNumber = notesToday.length == 0 ? 0 : Math.max(...notesToday.map(n => parseInt(n.split('-')[1])).filter(n => !isNaN(n)))
  const entryPath = padTheNumber((latestNumber + 1).toString(), 4)

  await Bun.write(`./output/${datePathPrefix}-${entryPath}.txt`, encrypted)

  let fileNumber = 1
  for (const file of files.filter(f => f.name)) { // for some reason files array isnt empty when no files are uploaded
    const bytes = Buffer.from(await file.arrayBuffer())

    const encryptedFile = await openpgp.encrypt({
      message: await openpgp.createMessage({ binary: bytes }), 
      encryptionKeys: publicKey,
      signingKeys: privateKey
    });

    await Bun.write(`./output/${datePathPrefix}-${entryPath}-${padTheNumber((fileNumber++).toString(), 4)}.` + file.name.split('.').at(-1), encryptedFile)
  }
  
  return 'done'
}, {
  body: t.Object({
    text: t.String(),
    files: t.Files(),
    password: t.Optional(t.String())
  })
})

app.listen(3000)
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

function padTheNumber(input: string, wantedSize: number) {
  return '0'.repeat(wantedSize - input.length) + input
}

# Servidor multiplayer de Blackout City

Servidor Node.js + WebSocket. Gestiona sales (codi de 6 caràcters), jugadors,
xat i sincronització de posicions. No té cap URL escrita: l'adreça la poses tu al joc.

## Fitxers
- `server.js`    el servidor
- `package.json` dependències i ordre d'inici (`npm start`)
- `README.md`    aquestes instruccions

## 1. (Opcional) Provar-ho al teu PC
1. Instal·la Node.js (versió LTS) des de https://nodejs.org
2. Obre una terminal dins la carpeta `blackout-server`
   (Windows: a la carpeta, escriu `cmd` a la barra d'adreces i prem Enter).
3. Escriu `npm install` i Enter.
4. Escriu `npm start` i Enter. Ha de dir: `Servidor multiplayer escoltant al port 8080`.
5. Al joc, com a servidor posa `ws://localhost:8080`.

## 2. Publicar-lo gratis a Render
1. Crea un compte a https://github.com i un repositori nou (botó "New").
2. Dins el repositori: "Add file" > "Upload files" i puja `server.js`, `package.json` i `README.md`. Prem "Commit changes".
3. Crea un compte a https://render.com (pots entrar amb GitHub).
4. "New +" > "Web Service" > tria el teu repositori.
5. Configura:
   - Runtime / Language: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free
6. Prem "Create Web Service" i espera que digui "Live".
7. Render et dona una adreça tipus `https://EL-TEU-NOM.onrender.com`.
   Per al joc has de canviar `https` per `wss`: `wss://EL-TEU-NOM.onrender.com`

Nota: al pla gratuït el servidor s'adorm si no s'usa durant una estona;
la primera connexió pot trigar fins a ~1 minut. Comprova les condicions actuals a Render.

## 3. Posar l'adreça al joc (tria una opció)
- A) Al menú del joc: JUGAR AMB AMICS > camp "Servidor multiplayer" > enganxa `wss://...`.
  Es guarda a aquest navegador (l'amic ho ha de fer al seu).
- B) Enllaç directe (no cal editar res):
  `https://LA-TEVA-WEB.netlify.app/?server=wss://EL-TEU-NOM.onrender.com`
- C) Fixa-la al HTML: busca `const MULTIPLAYER_SERVER_URL='';`, posa-hi l'adreça
  entre cometes i torna a pujar l'HTML a Netlify.

## 4. Jugar
1. Jugador 1: JUGAR AMB AMICS > CREAR PARTIDA > surt un codi (ex. ABC123).
2. Jugador 2 (altre navegador o dispositiu): mateixa web > UNIR-SE A UNA PARTIDA > escriu el codi.
3. Jugador 1 prem COMENÇAR PARTIDA. Tecla T = xat.

## Què sincronitza i què no
Sincronitza: jugadors, posició, rotació, animació, saltar, apuntar, cotxe que condueixen i xat.
NO sincronitza: vianants, trànsit, policia, missions ni botigues (cada navegador té els seus).
No pots pujar al cotxe d'un altre jugador.

# Cursor Link: Element Picker (Chrome Extension, MV3)

**Qué hace:** Permite seleccionar un elemento en cualquier página, capturar su contexto (selector CSS, `outerHTML`, estilos clave, bounding box y, si es posible, nombre de componente React) y **enviar** ese payload a:
- Un **endpoint local** (por defecto `http://127.0.0.1:3434/cursor`, método `POST`) para que tu servidor lo reenvíe a Cursor / LLM, o
- Un **deeplink** de Cursor (`cursor://...`) si lo tienes habilitado.

## Instalar (modo desarrollador)

1. Clona o descarga esta carpeta.
2. Chrome → `chrome://extensions/` → Activa **Developer mode** (arriba a la derecha).
3. `Load unpacked` → selecciona la carpeta de la extensión.
4. Pinnea la extensión si quieres acceso rápido.

## Uso

1. Abre el popup de la extensión.
2. (Opcional) Marca **Deeplink a Cursor** si deseas usar `cursor://...`.
3. Configura **Endpoint local** (si usas servidor) y añade **Notas / Prompt extra** (se adjuntan al payload).
4. Click en **“Seleccionar elemento”** → en la página, pasa el mouse (verás borde azul) y haz **clic** sobre el elemento objetivo.
5. El payload se envía al background:
   - Si usas **endpoint**, hará `POST` al endpoint configurado.
   - Si usas **deeplink**, abre una pestaña con `cursor://...` con `data` en base64.

## Endpoint sugerido (Node)

```js
// server.js (ejemplo)
import express from "express";
const app = express();
app.use(express.json({ limit: "2mb" }));

app.post("/cursor", async (req, res) => {
  const payload = req.body;
  console.log("Payload recibido:", payload.meta?.url, payload.selection?.cssSelector);

  // Aquí: formatea un prompt y llama a tu LLM o Cursor (MCP o API)
  // Por ejemplo, podrías guardar el payload a disco y abrir Cursor con un comando preconfigurado.

  res.send("ok");
});

app.listen(3434, () => console.log("Server on http://127.0.0.1:3434"));
```

## Notas técnicas

- **React**: el content script intenta usar claves internas (`__reactFiber$`) para obtener `componentName` y `ownerStack`. En producción/minificado puede no funcionar. Alternativa robusta: agregar `data-component="HeroTitle"` en el JSX raíz.
- **Selector robusto**: evita clases aleatorias largas; incorpora `role` cuando existe.
- **Estilos**: solo envía un subconjunto (tipografía, color, layout básico) para no sobrecargar.
- **Seguridad**: valida cualquier acción ejecutada con el payload en el servidor local.

## Roadmap
- Screenshot del elemento (`captureVisibleTab` + recorte por `box`).
- Modo múltiples selecciones (agrupar feedback).
- Perfiles de prompts (UX copy / UI layout / accesibilidad / performance).
- Integración MCP con Cursor para ida y vuelta.

```
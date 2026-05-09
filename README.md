# node-red-contrib-waterkotte

Node-RED node for the **Waterkotte** heat pump (EcoTouch / IDAL CGI interface — accessible at port 80 on the local LAN, e.g. on the EcoTouch wall display).

Reads multiple tags in **a single HTTP request**, manages the login token automatically (re-login on 401), exposes scaled values and decoded status registers as a clean `msg.payload` object.

## Why

The vendor offers no official Node-RED integration. Hand-built flows typically chain a dozen or more `http request` nodes, parse responses with custom function nodes, juggle the cookie-based `IDALToken` manually and break silently when the token expires. This package replaces all of that with two nodes.

## Install

In Node-RED → *Manage palette* → *Install* → search `waterkotte`.

Or from the command line:

```bash
cd ~/.node-red
npm install node-red-contrib-waterkotte
```

## Quick start

1. Drop a **waterkotte read** node onto a flow.
2. Create a new **waterkotte-config** with host (e.g. `192.168.3.90`), username and password (default on most installations: `waterkotte` / `waterkotte`).
3. Pick **Tag-Preset → All common tags** and a poll interval (e.g. `60` seconds).
4. Wire the output into a debug node — you will see something like:

```json
{
  "temp_outdoor":         12.4,
  "temp_outdoor_1h":      12.1,
  "temp_outdoor_24h":     11.8,
  "temp_return_set":      30.5,
  "temp_return":          30.2,
  "temp_flow":            33.1,
  "temp_water":           48.6,
  "heating_return":       30.4,
  "heating_set":          30.5,
  "percent_heat_circ_pump": 65,
  "percent_compressor":   42,
  "status_pump":          1,
  "status_evu":           0,
  "status_compressor":    1,
  "status_cooling_valve": 0,
  "status_water_valve":   0,
  "interruptions":        12
}
```

All values from one atomic round-trip — perfect for a single InfluxDB write.

## Built-in tag preset

| Tag  | Field                    | Unit | Description                  |
|------|--------------------------|------|------------------------------|
| A1   | `temp_outdoor`           | °C   | Außentemperatur aktuell      |
| A2   | `temp_outdoor_1h`        | °C   | Außentemperatur 1h Mittel    |
| A3   | `temp_outdoor_24h`       | °C   | Außentemperatur 24h Mittel   |
| A10  | `temp_return_set`        | °C   | Rücklauf Soll                |
| A11  | `temp_return`            | °C   | Rücklauf                     |
| A12  | `temp_flow`              | °C   | Vorlauf                      |
| A19  | `temp_water`             | °C   | Warmwasser                   |
| A30  | `heating_return`         | °C   | Heizung Rücklauf             |
| A31  | `heating_set`            | °C   | Heizung Soll                 |
| A51  | `percent_heat_circ_pump` | %    | Heizungsumwälzpumpe          |
| A58  | `percent_compressor`     | %    | Verdichterleistung           |
| I51  | `status_*`               | bits | Pump / EVU / Compressor / Cooling-valve / Water-valve |
| I53  | `interruptions`          |      | Unterbrechungen              |

`A`-tags are read as raw integers and divided by 10 (Waterkotte's standard fixed-point scaling). `I51` is bit-decoded into individual booleans.

## Custom tag list

Set **Tag-Preset → Custom (JSON)** to define your own tags:

```json
[
  { "tag": "A1",  "name": "outdoor", "scale": 0.1, "unit": "°C" },
  { "tag": "A19", "name": "ww",      "scale": 0.1, "unit": "°C" },
  { "tag": "I51", "name": "status",  "bits": { "1": "pump", "3": "compressor" } }
]
```

Field reference:

| Key     | Type   | Required | Default        | Notes                                                  |
|---------|--------|----------|----------------|--------------------------------------------------------|
| `tag`   | string | yes      | —              | Waterkotte tag (`A1`, `A11`, `I51`, `D…`, …)           |
| `name`  | string | no       | same as `tag`  | key in `msg.payload`                                   |
| `scale` | number | no       | `1`            | multiplier for the raw integer (`0.1` for °C / %)      |
| `unit`  | string | no       | `''`           | not used at runtime, only documentation                |
| `bits`  | object | no       | —              | `{ "<bit-1-indexed>": "fieldName" }`, decodes integer  |

## Options

- **Poll (s)** — fixed interval polling (`0` = read only when an input message arrives)
- **Bit-Felder flatten** — emit `status_pump` rather than `status.pump` (default on; nice for InfluxDB schemas)
- **Rohwerte mitschicken** — additionally include `<name>_raw` for every tag

## Token & error handling

- Login is performed lazily on the first read.
- The `IDALToken` cookie is reused across reads and across all `waterkotte-read` nodes that share the same config node.
- On `401`/`403`/`#E` responses the token is dropped, the client re-logs-in once and retries the read.
- All other failures (network timeout, parse error) propagate as a Node-RED `node.error` and can be caught with a `catch` node.

## Migrating from a hand-built flow

If your existing flow chains `http request → http request → http request …` and has a separate `String-to-Bitregister` subflow, replace the entire chain with **one** `waterkotte-read` node. The output object key names line up with the field names commonly used in the community (see preset table above), so InfluxDB writes and downstream switches keep working.

## Disclaimer

Not affiliated with Waterkotte GmbH. "Waterkotte" and "EcoTouch" are trademarks of their respective owners. Use at your own risk — this package only reads from the heat pump, never writes.

## License

MIT

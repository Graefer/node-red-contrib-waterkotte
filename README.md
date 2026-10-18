# node-red-contrib-waterkotte

Node-RED node for the **Waterkotte** heat pump (EcoTouch / IDAL CGI interface — accessible at port 80 on the local LAN, e.g. on the EcoTouch wall display).

Reads multiple tags in **a single HTTP request**, manages the login token automatically (re-login on 401), exposes scaled values and decoded status registers as a clean `msg.payload` object.

> **⚠ Breaking change in 0.1.5 — `status_*` field names changed.**
> Up to 0.1.4 the `I51` status register was decoded with bit numbers counted from 1, which shifted every bit by one (e.g. the alarm bit appeared as `status_cooling_valve`) and listed an EVU bit that is not part of `I51`.
> Since 0.1.5 bits are counted from 0 (as in openHAB's EcoTouch binding) and the fields are renamed — see [Status register I51](#status-register-i51).
> Old fields `status_pump`, `status_evu`, `status_cooling_valve` and `status_water_valve` no longer exist; `status_compressor` now carries the real compressor bit. EVU now comes from `I53` as `interruption_flags_evu`.
> Custom `bits` maps are counted from 0 as well — subtract 1 from every bit number of an existing 0.1.4 map to keep its meaning.
> `status._raw` and `interruptions` are unchanged.

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
  "status_source_pump":   1,
  "status_heating_pump":  1,
  "status_evd":           1,
  "status_compressor":    1,
  "status_compressor2":   0,
  "status_heater":        0,
  "status_alarm":         0,
  "status_cooling":       0,
  "status_water":         0,
  "status_pool":          0,
  "status_solar":         0,
  "status_cooling_4way":  0,
  "interruptions":        0,
  "interruption_flags_evu": 0
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
| I51  | `status_*`               | bits | Status-Register (see below)  |
| I53  | `interruptions`          |      | Unterbrechungen (raw number) |
| I53  | `interruption_flags_evu` | bit  | EVU-Sperre (bit 2 of \|I53\|) |

`A`-tags are read as raw integers and divided by 10 (Waterkotte's standard fixed-point scaling). `I51` is bit-decoded into individual `0`/`1` fields. `I53` is requested once and emitted twice: as the plain number `interruptions` and bit-decoded as `interruption_flags_*`.

### Status register I51

Bit numbers count from 0 (least significant bit), following [openHAB's EcoTouch binding](https://github.com/openhab/openhab-addons/blob/main/bundles/org.openhab.binding.ecotouch/src/main/java/org/openhab/binding/ecotouch/internal/EcoTouchTags.java).

| Bit | Value | Field                 | Description                     |
|-----|-------|-----------------------|---------------------------------|
| 0   | 1     | `status_source_pump`  | Quellenpumpe                    |
| 1   | 2     | `status_heating_pump` | Heizungspumpe                   |
| 2   | 4     | `status_evd`          | EVD                             |
| 3   | 8     | `status_compressor`   | Verdichter 1                    |
| 4   | 16    | `status_compressor2`  | Verdichter 2                    |
| 5   | 32    | `status_heater`       | Zusatzheizung / Heizstab        |
| 6   | 64    | `status_alarm`        | Alarm / Störung                 |
| 7   | 128   | `status_cooling`      | Kühlung                         |
| 8   | 256   | `status_water`        | Warmwasser                      |
| 9   | 512   | `status_pool`         | Pool                            |
| 10  | 1024  | `status_solar`        | Solar                           |
| 11  | 2048  | `status_cooling_4way` | Kühlung 4-Wege-Ventil           |

Example: `I51 = 355` (256 + 64 + 32 + 2 + 1) → source pump, heating pump, heater, alarm and hot water are on.

### Interruptions I53 (EVU)

The pump can report `I53` as a negative number. `interruption_flags` therefore decodes the bits of the absolute value (`"abs": true`): bit 2 (value 4) is the EVU block (utility lock-out). Example: `I53 = -32764` → `|I53| = 32764` → `interruption_flags_evu = 1`; `I53 = 0` → `0`. Other `I53` bits are not documented and are not decoded.

## Custom tag list

Set **Tag-Preset → Custom (JSON)** to define your own tags:

```json
[
  { "tag": "A1",  "name": "outdoor", "scale": 0.1, "unit": "°C" },
  { "tag": "A19", "name": "ww",      "scale": 0.1, "unit": "°C" },
  { "tag": "I51", "name": "status",  "bits": { "1": "heating_pump", "3": "compressor" } },
  { "tag": "I53", "name": "evu",     "abs": true, "bits": { "2": "lock" } }
]
```

Field reference:

| Key     | Type   | Required | Default        | Notes                                                  |
|---------|--------|----------|----------------|--------------------------------------------------------|
| `tag`   | string | yes      | —              | Waterkotte tag (`A1`, `A11`, `I51`, `D…`, …)           |
| `name`  | string | no       | same as `tag`  | key in `msg.payload`                                   |
| `scale` | number | no       | `1`            | multiplier for the raw integer (`0.1` for °C / %)      |
| `unit`  | string | no       | `''`           | not used at runtime, only documentation                |
| `bits`  | object | no       | —              | `{ "<bit-0-indexed>": "fieldName" }`, decodes integer (since 0.1.5 counted from 0) |
| `abs`   | bool   | no       | `false`        | decode `bits` from the absolute value (`_raw` keeps the sign) |

## Options

- **Poll (s)** — fixed interval polling (`0` = read only when an input message arrives)
- **Bit-Felder flatten** — emit `status_alarm` rather than `status.alarm` (default on; nice for InfluxDB schemas)
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

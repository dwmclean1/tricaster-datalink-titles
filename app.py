import json
from uuid import uuid4
import xml.etree.ElementTree as ET
from dataclasses import dataclass
import asyncio
from quart import Quart, render_template, request, redirect, jsonify, url_for, Response
from DataLink import Datalink_Connection_Handler
import logging

app = Quart(__name__)


DB_PATH = "./json/db.json"
CONFIG_PATH = "./json/config.json"

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


@dataclass
class ServerSentEvent:
    data: str
    event: str | None = None
    id: int | None = None
    retry: int | None = None

    def encode(self) -> bytes:
        message = f"data: {self.data}"
        if self.event is not None:
            message = f"{message}\nevent: {self.event}"
        if self.id is not None:
            message = f"{message}\nid: {self.id}"
        if self.retry is not None:
            message = f"{message}\nretry: {self.retry}"
        message = f"{message}\n\n"
        return message.encode("utf-8")


async def update_smb_config(config):
    if datalink:
        await datalink.close()
        datalink.server = config["server"]
        datalink.share = config["share"]
        datalink.file_path = config["file_path"]
        datalink.username = config["username"]
        datalink.password = config["password"]


async def get_live_cue():
    db = await load_db()
    for cue in db:
        if cue["live"] == True:
            return cue


async def load_db():
    try:
        with open(DB_PATH, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except Exception as e:
        app.logger.error(f"Error loading database: {e}")


async def save_db(db):
    try:
        with open(DB_PATH, "w") as f:
            json.dump(db, f)
    except Exception as e:
        app.logger.error(f"Error saving database: {e}")


def load_config():
    try:
        with open(CONFIG_PATH, "r") as f:
            config = json.load(f)
            app.logger.info(f"Config Loaded: {config}")
            return config
    except FileNotFoundError:
        return {}
    except Exception as e:
        app.logger.error(f"Error loading config: {e}")


async def save_config(config):
    try:
        with open(CONFIG_PATH, "w") as f:
            json.dump(config, f)
            app.logger.info(f"Config Saved: {config}")
            return config
    except Exception as e:
        app.logger.error(f"Error saving config: {e}")


async def create_datalink_xml(title):
    e_root = ET.Element("DATALINK_VALUES")
    e_data = ET.Element("DATA")
    e_name = ET.SubElement(e_data, "NAME")
    e_name.text = title["name"]
    e_title = ET.SubElement(e_data, "TITLE")
    e_title.text = title["title"]
    e_id = ET.SubElement(e_data, "ID")
    e_id.text = title["id"]
    e_root.append(e_data)

    return ET.tostring(e_root, encoding="unicode")


async def rebuildXML():
    db = await load_db()
    for cue in db:
        if cue["live"] == True:
            xml = await create_datalink_xml(cue)
            await datalink.write(xml)

    message = json.dumps(
        {
            "connected": datalink.session._connected,
            "error": "No XML data. Rebuilding XML.",
        }
    )


# FLASK ROUTES
@app.route("/")
async def index():
    return await render_template("index.html")


@app.post("/add")
async def add():
    try:
        data = await request.form
        db = await load_db()

        new_entry = {
            "id": uuid4().hex,
            "name": data["name"],
            "title": data["title"],
            "type": data["type"],
            "order": len(db) + 1,
            "live": False,
            "upNext": False,
        }

        db.append(new_entry)
        await save_db(db)
        return redirect(url_for("index"))
    except Exception as e:
        return jsonify(success=False, error=e)


@app.post("/edit")
async def edit_cue():
    try:
        data = await request.form
        db = await load_db()
        for entry in db:
            if entry["id"] == data["id"]:
                entry["name"] = data["name"]
                entry["title"] = data["title"]
                entry["type"] = data["type"]
                await save_db(db)
        await send()
        return redirect(url_for("index"))
    except Exception as e:
        return jsonify(error=e.args[0], success=False)


@app.post("/delete")
async def delete_cue():
    try:
        id = await request.json
        db = await load_db()

        for item in db:
            if item["id"] == id:
                db.remove(item)

        for index, item in enumerate(db):
            item["order"] = index + 1

        await save_db(db)
        return jsonify(success=True)
    except Exception as e:
        return jsonify(error=e.args[0], success=False)


@app.get("/load-db")
async def load():
    return await load_db()


@app.post("/save-db")
async def save():
    try:
        data = await request.json
        await save_db(data)
        return jsonify(success=True)
    except Exception as e:
        return jsonify(error=e.args[0], success=False)


@app.get("/status")
async def status():
    async def generator():
        message = {"connected": False, "error": None}
        try:
            message["connected"] = await datalink.ping()
        except Exception as e:
            message["error"] = e
        finally:
            app.logger.info(f"Sent status: {message}")
            yield ServerSentEvent(json.dumps(message)).encode()
            await asyncio.sleep(5)

    return Response(generator(), content_type="text/event-stream")


@app.get("/live")
async def send():
    try:
        live_cue = await get_live_cue()
        xml = await create_datalink_xml(live_cue)
        await datalink.write(xml)
        return jsonify(data=live_cue, success=True)
    except Exception as e:
        return jsonify(error=e.args[0], success=False)


@app.post("/live")
async def clear():
    try:
        data = await request.json
        xml = await create_datalink_xml({"name": "Name", "title": "Title", "id": 0})
        await datalink.write(xml)

        await save_db(data)
        return jsonify(success=True)
    except Exception as e:
        return jsonify(error=e.args[0], success=False)


@app.route("/config", methods=["GET", "POST"])
async def config():

    if request.method == "POST":
        try:
            data = await request.form
            config = dict(data)
            await save_config(config)
            await update_smb_config(config)
            return redirect(url_for("index"))
        except Exception as e:
            return jsonify(error=e.args[0], success=False)

    if request.method == "GET":
        try:
            config = load_config()
            return jsonify(data=config, success=True)
        except Exception as e:
            return jsonify(error=e.args[0], success=False)


SMB_CONFIG = load_config()

datalink = Datalink_Connection_Handler(
    SMB_CONFIG["server"],
    SMB_CONFIG["share"],
    SMB_CONFIG["username"],
    SMB_CONFIG["password"],
    SMB_CONFIG["file_path"],
)

if __name__ == "__main__":
    app.run(debug=True)
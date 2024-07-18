from pathlib import PureWindowsPath
from uuid import uuid4
import logging

import smbclient
from smbprotocol.connection import Connection

logger = logging.getLogger(__name__)


class Datalink_Connection_Handler:
    def __init__(self, server, share, username, password, file_path) -> None:
        self.server: str = server
        self.share: str = share
        self.username: str = username
        self.password: str = password
        self.file_path = PureWindowsPath(file_path)
        self.file = None
        self.session = None
        smbclient.ClientConfig(username=self.username, password=self.password)

    async def _open(self, mode):
        try:
            if not self.session:
                await self._connect()
            self.file = smbclient.open_file(
                rf"//{self.server}/{self.share}/{str(self.file_path)}", mode
            )
        except Exception as e:
            logger.error(f"open error: {e}")
            raise e

    async def _connect(self):
        try:
            self.session = smbclient.register_session(
                server=self.server,
                username=self.username,
                password=self.password,
                connection_timeout=0.5,
                auth_protocol='ntlm'
            )
        except TimeoutError as e:
            logger.info(f"connect timeout: {e}")
            await self.close()
            raise e
        except Exception as e:
            logger.error(f"connect error: {e}")
            raise e

    async def read(self):
        try:
            if not self.file or self.file.closed:
                await self._open("r")
            self.file.seek(0)
            data = self.file.read()
            return data
        except Exception as e:
            logger.error(f"read error: {e}")
            raise e

    async def write(self, xml):
        try:
            if not self.file or self.file.closed:
                await self._open("w")
            self.file.write(xml)
            self.file.close()
        except Exception as e:
            logger.error(f"write error: {e}")
            raise e

    async def ping(self):
        connected = False
        try:
            connection = Connection(uuid4(), self.server)
            connection.connect(timeout=1)
            connected = True
        except Exception as e:
            logger.error(f"Ping error: {e}")
            connected = False
        finally:
            connection.disconnect()
            return connected

    async def close(self):
        if not self.file.closed:
            self.file.close()
        if not self.session._connected:
            self.session.disconnect()

from pydantic import BaseModel

#modelo de datos de la huella dactilar
class Huella(BaseModel):
    id: int
    huella_blob: str
    usuario_id: int
    class Config:
        orm_mode = True
    
class createHuella(Huella):
    huella_blob: str
    usuario_id: int


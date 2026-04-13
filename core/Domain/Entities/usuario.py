#entidad de usuario, con sus atributos y relaciones
from pydentic import BaseModal, FieldValidators, ConfigDict
from typing import Optional
from .huella import Huella

class nombreLimpio(BaseModal):
    original:str
    limpio:str

class Usuario(BaseModal):
    nombre: str
    curso_id: int

class createUsuario(UsuarioBase):
    nombre: str = FieldValidators(min_length=2, max_length=100)
    curso_id: int

class enrolarUsuario(UsuarioBase):
    rut: Optional[str] = None
    es_pae: bool = True
    huella: Optional[Huella] = None 

class UsuarioRead(UsuarioBase):
    id: int
    rut: Optional[str] = None
    es_pae: bool = True
    curso_id: int
    estado_id: Optional[int] = None
    huella: Optional[Huella] = None 

    class Config:
        orm_mode = True   
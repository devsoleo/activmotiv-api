# activmotiv-api
## API
### Account System
POST /first-login
Description : Permet de définir un mot de passe par défaut à la première connexion (ne permet pas de se connecter il faut utiliser /login ensuite)

POST /login
Description : Permet de se connecter

POST /admin/create-account
Description : Permet à un utilisateur admin de créer un compte utilisateur
Args:
  - account_uid : UID du nouveau compte
  - account_password : Mot de passe du nouveau compte
  - account_is_admin : Est-ce que le nouveau compte est admin

### Stats

PUT /tracking/opening
Description : Ajoute une ou plusieurs ouverture

GET /tracking/opening/amount
Description : Permet de récupérer le nombre d'entrées (d'opening) d'un utilisateur
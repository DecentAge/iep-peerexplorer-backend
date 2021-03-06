#!/bin/bash

set -o nounset
set -o errexit
set -o allexport

init_secret() {
	local secret_name="$1"
	if [[ -f "/run/secrets/${secret_name}" ]]; then
		echo "Initializing secret "${secret_name}" from secret /run/secrets/${secret_name}"
		local secret_value="$(cat /run/secrets/${secret_name})"
		export ${secret_name}="${secret_value}"
	elif [[ -n ${secret_name:-} ]]; then
		echo "Initializing secret ${secret_name} from variable ${secret_name}"
	else
        echo >&2 "error: both ${secret_name} and /run/secrets/${secret_name} are not set"
		exit 1		
	fi
	
}
NODE_ENV=${NODE_ENV:-production}
init_secret "MONGO_PASSWORD"
exec "$@"
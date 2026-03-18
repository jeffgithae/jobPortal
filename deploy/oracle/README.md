# Oracle VM Deployment

This folder contains a single-host deployment path for running both the Angular frontend and the NestJS API on an Oracle Cloud Always Free Ubuntu VM.

## What the bootstrap script does

- Installs `git`, `nginx`, build tooling, and Node.js `22`
- Clones or updates this repo into `/opt/jobPortal`
- Writes `api/.env`
- Builds the NestJS API and Angular frontend
- Creates a `systemd` service for the API
- Creates and enables an Nginx site
- Optionally enables Let's Encrypt if you pass a domain and email

## Oracle prerequisites

Before running the script:

1. Create an Ubuntu VM in your Oracle home region.
2. Reserve and attach a public IP.
3. In Oracle networking, allow inbound `22`, `80`, and `443`.
4. Point your domain or subdomain A record to the VM IP.
5. Make sure Mongo Atlas allows connections from the VM.

Example DNS target:

- `jobs.example.com -> <oracle-vm-public-ip>`

## Recommended usage

Run on the VM as `root` or with `sudo`:

```bash
sudo bash deploy/oracle/bootstrap-oracle-vm.sh \
  --domain jobs.example.com \
  --mongo-uri 'mongodb+srv://USER:PASSWORD@cluster.mongodb.net/job-portal?retryWrites=true&w=majority&appName=JobPortal' \
  --cors-origin 'https://jobs.example.com' \
  --letsencrypt-email you@example.com
```

If you want to use the VM IP temporarily instead of a domain:

```bash
sudo bash deploy/oracle/bootstrap-oracle-vm.sh \
  --public-origin 'http://<vm-public-ip>' \
  --mongo-uri 'mongodb+srv://USER:PASSWORD@cluster.mongodb.net/job-portal?retryWrites=true&w=majority&appName=JobPortal' \
  --cors-origin 'http://<vm-public-ip>'
```

## Files the script creates

- API env: `/opt/jobPortal/api/.env`
- API service: `/etc/systemd/system/jobportal-api.service`
- Nginx site: `/etc/nginx/sites-available/jobportal.conf`

Reference Nginx config:

- [nginx.jobportal.conf.template](/c:/Dev/jobPortal/deploy/oracle/nginx.jobportal.conf.template)

## After deployment

Check:

```bash
systemctl status jobportal-api
nginx -t
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1/api/health
```

Public URLs:

- Frontend: `https://jobs.example.com`
- API health: `https://jobs.example.com/api/health`

## Updating later

Re-run the same script on the VM. It will:

- pull the latest code from the configured branch
- rebuild API and frontend
- restart the API service
- reload Nginx

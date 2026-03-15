# LR Ride Deployment Runbook

## 1 — Terraform (AWS)
cd infrastructure/terraform
terraform init && terraform plan -out=tfplan && terraform apply tfplan
aws eks update-kubeconfig --region eu-west-1 --name lrride-cluster

## 2 — Secrets
cp backend/.env.production.example backend/.env.production
# fill all values
kubectl apply -f infrastructure/kubernetes/namespace.yaml
kubectl create secret generic lrride-secrets --from-env-file=backend/.env.production -n lrride

## 3 — Build images
docker build -f infrastructure/docker/backend.Dockerfile -t lrride/backend:1.0.0 ./backend
docker build -f infrastructure/docker/frontend.Dockerfile -t lrride/frontend:1.0.0 ./frontend
docker push lrride/backend:1.0.0 && docker push lrride/frontend:1.0.0

## 4 — Deploy
kubectl apply -f infrastructure/kubernetes/
kubectl apply -f infrastructure/monitoring/

## 5 — Verify
kubectl get pods -n lrride
curl https://yourdomain.com/health/

## Rollback
kubectl rollout undo deployment/backend -n lrride

## Scale
kubectl scale deployment/backend --replicas=4 -n lrride
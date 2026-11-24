#!/usr/bin/env bash
# Cria os rótulos da triagem no repositório atual. Precisa do GitHub CLI (gh) logado.
# --force atualiza se o rótulo já existir.
set -e

gh label create "triagem"      --color FBCA04 --description "Defeito novo, ainda não triado" --force
gh label create "sev:critica"  --color B60205 --description "Perda de dinheiro ou de dados, bloqueia o uso" --force
gh label create "sev:alta"     --color D93F0B --description "Regra de negócio errada, sem contorno simples" --force
gh label create "sev:media"    --color FBCA04 --description "Atrapalha, mas tem contorno" --force
gh label create "sev:baixa"    --color C2E0C6 --description "Cosmético" --force
gh label create "prio:alta"    --color 5319E7 --description "Corrigir antes de publicar" --force
gh label create "prio:media"   --color 8B6FD6 --description "Corrigir na próxima versão" --force
gh label create "prio:baixa"   --color D4C5F9 --description "Quando der" --force
gh label create "duplicate"    --color CFD3D7 --description "Já registrado em outra issue" --force

# Migration Guide: Module Federation to Native Federation for Angular

## Motivation

Since Angular 17, the CLI ships with an esbuild-based builder that is remarkable faster than the original webpack-based solution. This new builder is used for newly generated projects and beginning with Angular 18 ng updates also migrates existing projects.

Native Federation for Angular is a thin wrapper around the esbuild builder that allows to use the proven mental model of Module Federation.

## Prerequisites

- Update your solution to the newest Angular and CLI version
- Update your solution to the newest version of `@angular-architects/module-federation`
- Have a look to our [FAQs about sharing packages with Native Federation](share-faq.md)

## Migration for Angular CLI projects

## Migration for Nx projects

## Issues

We have tested this guide with several projects. However, e

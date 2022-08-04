import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebComponentWrapper } from './web-components/web-component-wrapper';

@NgModule({
  imports: [CommonModule],
  declarations: [WebComponentWrapper],
  exports: [WebComponentWrapper],
})
export class ModuleFederationToolsModule {}

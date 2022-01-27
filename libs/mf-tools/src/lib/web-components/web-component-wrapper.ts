import { AfterContentInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadRemoteModuleOptions, loadRemoteModule } from '@angular-architects/module-federation';

export type WebComponentWrapperOptions = LoadRemoteModuleOptions & {
    elementName: string;
};

@Component({
  selector: 'mft-wc-wrapper',
  template: '<div #vc></div>',
})
// eslint-disable-next-line @angular-eslint/component-class-suffix
export class WebComponentWrapper implements AfterContentInit, OnChanges {

  @ViewChild('vc', {read: ElementRef, static: true})
  vc: ElementRef;

  @Input() options: WebComponentWrapperOptions;
  @Input() props: { [prop: string]: unknown };
  @Input() events: { [event: string]: (event: Event) => void };

  element: HTMLElement;

  constructor(
    private route: ActivatedRoute) { 


    }

  ngOnChanges(): void {
    if (!this.element) return;

    this.populateProps();
  }

  private populateProps() {
    for (const prop in this.props) {
      this.element[prop] = this.props[prop];
    }
  }

  private setupEvents() {
    for (const event in this.events) {
      this.element.addEventListener(event, this.events[event]);
    }
  }

  async ngAfterContentInit() {

    const options = this.options ?? this.route.snapshot.data as WebComponentWrapperOptions;
   
    try {
        await loadRemoteModule(options);

        this.element = document.createElement(options.elementName);
        this.populateProps();
        this.setupEvents();

        this.vc.nativeElement.appendChild(this.element);
    }
    catch(error) {
        console.error(error);
    }

  }

}
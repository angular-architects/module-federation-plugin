import {
  AfterContentInit,
  Component,
  ElementRef,
  InjectionToken,
  Injector,
  Input,
  OnChanges,
  ProviderToken,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  LoadRemoteModuleOptions,
  loadRemoteModule,
} from '@angular-architects/module-federation';

export type Events = { [event: string]: <T>(event: T) => void };

export type WebComponentWrapperOptions = LoadRemoteModuleOptions & {
  elementName: string;
  props?: { [prop: string]: unknown };
  events?: Events;
  shadowDom?: ShadowRootInit;
};

@Component({
  selector: 'mft-wc-wrapper',
  template: '<div #vc></div>',
})
// eslint-disable-next-line @angular-eslint/component-class-suffix
export class WebComponentWrapper implements AfterContentInit, OnChanges {
  @ViewChild('vc', { read: ElementRef, static: true })
  vc: ElementRef;

  @Input() options: WebComponentWrapperOptions;
  @Input() props: { [prop: string]: unknown };
  @Input() events: Events;

  element: HTMLElement;

  constructor(private route: ActivatedRoute) {}

  ngOnChanges(): void {
    if (!this.element) return;

    this.populateProps();
  }

  private populateProps() {
    this.props = this.props ?? this.options.props;
    for (const prop in this.props) {
      this.element[prop] = this.props[prop];
    }
  }

  private setupEvents() {
    this.events = this.events ?? this.options.events;
    for (const event in this.events) {
      this.element.addEventListener(event, this.events[event]);
    }
  }

  async ngAfterContentInit() {
    this.options =
      this.options ?? (this.route.snapshot.data as WebComponentWrapperOptions);

    try {
      await loadRemoteModule(this.options);
      this.element = document.createElement(this.options.elementName);
      this.populateProps();
      this.setupEvents();

      if (this.options.shadowDom) {
        const shadow = this.vc.nativeElement.attachShadow({ mode: 'open' });
        shadow.appendChild(this.element);
      } else {
        this.vc.nativeElement.appendChild(this.element);
      }
    } catch (error) {
      console.error(error);
    }
  }
}

import React, { PureComponent, ChangeEvent } from 'react';
import { SelectableValue } from '@grafana/data';
import { CloudWatchQuery } from '../types';
import {
  Input,
  QueryEditorProps,
  Segment,
  SegmentAsync,
  ValidationEvents,
  EventsWithValidation,
  Switch,
} from '@grafana/ui';
import DataSource, { Options } from '../datasource';
import { Stats, Dimensions, FormField, Alias } from './';

type Props = QueryEditorProps<DataSource, CloudWatchQuery, Options>;

interface State {
  regions: Array<SelectableValue<string>>;
  namespaces: Array<SelectableValue<string>>;
  metricNames: Array<SelectableValue<string>>;
  variableOptionGroup: SelectableValue<string>;
}

const idValidationEvents: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: value => new RegExp(/^$|^[a-z][a-zA-Z0-9_]*$/).test(value),
      errorMessage: 'Invalid format. Only alphanumeric characters and underscores are allowed',
    },
  ],
};

export class CloudWatchQueryEditor extends PureComponent<Props, State> {
  state: State = { regions: [], namespaces: [], metricNames: [], variableOptionGroup: {} };

  componentWillMount() {
    const { query } = this.props;

    if (!query.hasOwnProperty('statistics')) {
      query.statistics = [];
    }

    if (!query.hasOwnProperty('expression')) {
      query.expression = '';
    }

    if (!query.hasOwnProperty('dimensions')) {
      query.dimensions = {};
    }
  }

  componentDidMount() {
    const { datasource } = this.props;
    const variableOptionGroup = {
      label: 'Template Variables',
      options: this.props.datasource.variables.map(v => ({ label: v, value: v })),
    };
    Promise.all([datasource.metricFindQuery('regions()'), datasource.metricFindQuery('namespaces()')]).then(
      ([regions, namespaces]) => {
        this.setState({
          ...this.state,
          regions: [...regions, variableOptionGroup],
          namespaces: [...namespaces, variableOptionGroup],
          variableOptionGroup,
        });
      }
    );
  }

  loadMetricNames = async () => {
    const { namespace, region } = this.props.query;
    return this.props.datasource.metricFindQuery(`metrics(${namespace},${region})`).then(this.appendTemplateVariables);
  };

  appendTemplateVariables = (values: SelectableValue[]) => [
    ...values,
    { label: 'Template Variables', options: this.props.datasource.variables.map(v => ({ label: v, value: v })) },
  ];

  onChange(query: CloudWatchQuery) {
    const { onChange, onRunQuery } = this.props;
    onChange(query);
    onRunQuery();
  }

  render() {
    const { query, datasource } = this.props;
    const { regions, namespaces, variableOptionGroup: variableOptionGroup } = this.state;
    return (
      <>
        <FormField
          className="query-keyword"
          label="Region"
          width={24}
          grow
          inputEl={
            <Segment
              value={query.region}
              options={regions}
              allowCustomValue
              onChange={region => this.onChange({ ...query, region })}
            />
          }
        />
        {query.expression.length === 0 && (
          <>
            <FormField
              className="query-keyword"
              label="Namespace"
              grow
              inputEl={
                <Segment
                  value={query.namespace}
                  allowCustomValue
                  options={namespaces}
                  onChange={namespace => this.onChange({ ...query, namespace })}
                />
              }
            />

            <FormField
              className="query-keyword"
              label="Metric Name"
              grow
              inputEl={
                <SegmentAsync
                  value={query.metricName}
                  allowCustomValue
                  loadOptions={this.loadMetricNames}
                  onChange={metricName => this.onChange({ ...query, metricName })}
                />
              }
            />

            <FormField
              className="query-keyword"
              label="Stats"
              grow
              inputEl={
                <Stats
                  values={query.statistics}
                  onChange={statistics => this.onChange({ ...query, statistics })}
                  variableOptionGroup={variableOptionGroup}
                />
              }
            />

            <FormField
              className="query-keyword"
              grow
              label="Dimensions"
              inputEl={
                <Dimensions
                  dimensions={query.dimensions}
                  onChange={dimensions => this.onChange({ ...query, dimensions })}
                  loadKeys={() =>
                    datasource.getDimensionKeys(query.namespace, query.region).then(this.appendTemplateVariables)
                  }
                  loadValues={newKey => {
                    const { [newKey]: value, ...newDimensions } = query.dimensions;
                    return datasource
                      .getDimensionValues(query.region, query.namespace, query.metricName, newKey, newDimensions)
                      .then(this.appendTemplateVariables);
                  }}
                />
              }
            />
          </>
        )}

        {query.statistics.length === 1 && (
          <div className="gf-form-inline">
            <FormField
              className="query-keyword"
              label="Id"
              tooltip="Id can include numbers, letters, and underscore, and must start with a lowercase letter."
              inputEl={
                <Input
                  className={`gf-form-input width-${8}`}
                  onBlur={console.log}
                  validationEvents={idValidationEvents}
                  value={query.id}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    this.onChange({ ...query, id: event.target.value })
                  }
                />
              }
            />
            <FormField
              className="query-keyword"
              label="Expression"
              inputEl={
                <Input
                  className={`gf-form-input width-${28}`}
                  onBlur={console.log}
                  value={query.expression}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    this.onChange({ ...query, expression: event.target.value })
                  }
                />
              }
            />
          </div>
        )}

        <div className="gf-form-inline">
          <FormField
            className="query-keyword"
            label="Min Period"
            tooltip="Minimum interval between points in seconds"
            inputEl={
              <Input
                className={`gf-form-input width-${16}`}
                onBlur={console.log}
                value={query.period}
                placeholder="auto"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  this.onChange({ ...query, period: event.target.value })
                }
              />
            }
          />
          <FormField
            className="query-keyword"
            label="Alias"
            tooltip="Alias replacement variables: {{metric}}, {{stat}}, {{namespace}}, {{region}}, {{period}}, {{label}}, {{YOUR_DIMENSION_NAME}}"
            inputEl={
              <Alias value={query.alias} onChange={(value: string) => this.onChange({ ...query, alias: value })} />
            }
          />
          <Switch
            label="HighRes"
            checked={query.highResolution}
            onChange={() => this.onChange({ ...query, highResolution: !query.highResolution })}
          />
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
      </>
    );
  }
}
